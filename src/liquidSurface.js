async function loadShaders() {
  const [vertRes, fragRes] = await Promise.all([
    fetch("src/shaders/ripple.vert"),
    fetch("src/shaders/ripple.frag"),
  ]);
  if (!vertRes.ok || !fragRes.ok) {
    throw new Error("shader fetch failed");
  }
  return Promise.all([vertRes.text(), fragRes.text()]);
}

const CONFIG = {
  SPEED: 1.04,
  STRENGTH: 0.96,
  DISTORTION: 0.04,
  DECAY: 1.25,
  MAX_RIPPLES: 6,
  FREQUENCY: 24,
  REF_SIZE: 480,
  REF_HEIGHT: 200,
};

const SHADER_SLOTS = 8;
const PAPER = "#f7f4ef";
const BLUE = "#1727B3";

function shouldSkip() {
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(log || "shader compile failed");
  }
  return shader;
}

function createProgram(gl, vert, frag) {
  const program = gl.createProgram();
  const vs = compile(gl, gl.VERTEX_SHADER, vert);
  const fs = compile(gl, gl.FRAGMENT_SHADER, frag);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(log || "program link failed");
  }
  return program;
}

function isShown(el) {
  if (!el || el.hidden) return false;
  if (el.closest("[hidden]")) return false;
  const cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden") return false;
  if (Number(cs.opacity) < 0.04) return false;
  return true;
}

function fillColor(host) {
  return host.closest("#contact") ? BLUE : PAPER;
}

function drawFittedImage(ctx, img, rect, fit) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) return;

  const mode = fit === "contain" ? "contain" : "cover";
  const scale =
    mode === "contain"
      ? Math.min(rect.width / iw, rect.height / ih)
      : Math.max(rect.width / iw, rect.height / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = rect.left + (rect.width - dw) / 2;
  const dy = rect.top + (rect.height - dh) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.left, rect.top, rect.width, rect.height);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function createLayer(host, vertSrc, fragSrc) {
  const canvas = document.createElement("canvas");
  canvas.className = "liquid-canvas";
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
  });

  if (!gl) {
    canvas.remove();
    return null;
  }

  let program;
  try {
    program = createProgram(gl, vertSrc, fragSrc);
  } catch {
    canvas.remove();
    return null;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );

  const aPosition = gl.getAttribLocation(program, "aPosition");
  const loc = {
    texture: gl.getUniformLocation(program, "uTexture"),
    resolution: gl.getUniformLocation(program, "uResolution"),
    time: gl.getUniformLocation(program, "uTime"),
    pos: Array.from({ length: SHADER_SLOTS }, (_, i) => gl.getUniformLocation(program, `uRipplePos[${i}]`)),
    birth: Array.from({ length: SHADER_SLOTS }, (_, i) => gl.getUniformLocation(program, `uRippleTime[${i}]`)),
    strength: Array.from({ length: SHADER_SLOTS }, (_, i) => gl.getUniformLocation(program, `uRippleStrength[${i}]`)),
    speed: gl.getUniformLocation(program, "uSpeed"),
    amount: gl.getUniformLocation(program, "uStrength"),
    distortion: gl.getUniformLocation(program, "uDistortion"),
    decay: gl.getUniformLocation(program, "uDecay"),
    frequency: gl.getUniformLocation(program, "uFrequency"),
    scale: gl.getUniformLocation(program, "uScale"),
  };

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([247, 244, 239, 255]));

  const captureCanvas = document.createElement("canvas");
  const captureCtx = captureCanvas.getContext("2d", { alpha: false });
  const img = host.querySelector("img");

  const ripples = [];
  const posData = new Float32Array(SHADER_SLOTS * 2);
  const timeData = new Float32Array(SHADER_SLOTS);
  const strengthData = new Float32Array(SHADER_SLOTS);

  let width = 0;
  let height = 0;
  let cssW = 1;
  let cssH = 1;
  let frameId = 0;
  let running = false;
  let lastX = 0;
  let lastY = 0;
  let lastMove = 0;
  let lastSpawn = 0;
  let primed = false;
  let destroyed = false;

  function resize() {
    if (destroyed || !isShown(host)) return false;
    const box = host.getBoundingClientRect();
    cssW = Math.max(box.width, 1);
    cssH = Math.max(box.height, 1);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nextW = Math.max(1, Math.round(cssW * dpr));
    const nextH = Math.max(1, Math.round(cssH * dpr));
    if (nextW === width && nextH === height) return false;
    width = nextW;
    height = nextH;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    captureCanvas.width = width;
    captureCanvas.height = height;
    gl.viewport(0, 0, width, height);
    return true;
  }

  function capture() {
    if (destroyed || !width || !height) return;
    try {
      const box = host.getBoundingClientRect();
      const dpr = width / Math.max(box.width, 1);
      captureCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      captureCtx.fillStyle = fillColor(host);
      captureCtx.fillRect(0, 0, box.width, box.height);

      if (img && img.complete && img.naturalWidth) {
        const imgRect = img.getBoundingClientRect();
        const local = {
          left: imgRect.left - box.left,
          top: imgRect.top - box.top,
          width: imgRect.width,
          height: imgRect.height,
        };
        drawFittedImage(captureCtx, img, local, getComputedStyle(img).objectFit);
      }

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, captureCanvas);
    } catch {
      /* keep previous texture */
    }
  }

  function spawn(x, y, strength) {
    const now = performance.now() * 0.001;
    const next = { x, y, time: now, strength };
    if (ripples.length < CONFIG.MAX_RIPPLES) {
      ripples.push(next);
      return;
    }
    let idx = 0;
    let oldest = ripples[0].time;
    for (let i = 1; i < ripples.length; i += 1) {
      if (ripples[i].time < oldest) {
        oldest = ripples[i].time;
        idx = i;
      }
    }
    ripples[idx] = next;
  }

  function prune(now) {
    const life = 3.2 / CONFIG.DECAY;
    for (let i = ripples.length - 1; i >= 0; i -= 1) {
      if (now - ripples[i].time > life || ripples[i].strength < 0.01) {
        ripples.splice(i, 1);
      }
    }
  }

  function pack(now) {
    posData.fill(0);
    timeData.fill(0);
    strengthData.fill(0);
    for (let i = 0; i < ripples.length && i < SHADER_SLOTS; i += 1) {
      const ripple = ripples[i];
      posData[i * 2] = ripple.x;
      posData[i * 2 + 1] = ripple.y;
      timeData[i] = ripple.time;
      const age = Math.max(0, now - ripple.time);
      strengthData[i] = ripple.strength * Math.exp(-age * CONFIG.DECAY * 0.14);
    }
  }

  function localUV(event) {
    const box = host.getBoundingClientRect();
    return {
      x: (event.clientX - box.left) / Math.max(box.width, 1),
      y: (event.clientY - box.top) / Math.max(box.height, 1),
    };
  }

  function draw(nowMs) {
    if (destroyed) return;
    const now = nowMs * 0.001;
    prune(now);
    pack(now);

    const span = Math.max(Math.min(cssW, cssH), 1);
    const distortion = CONFIG.DISTORTION * (CONFIG.REF_SIZE / span);
    const scale = cssH / CONFIG.REF_HEIGHT;

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.BLEND);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(loc.texture, 0);
    gl.uniform2f(loc.resolution, width, height);
    gl.uniform1f(loc.time, now);
    for (let i = 0; i < SHADER_SLOTS; i += 1) {
      gl.uniform2f(loc.pos[i], posData[i * 2], posData[i * 2 + 1]);
      gl.uniform1f(loc.birth[i], timeData[i]);
      gl.uniform1f(loc.strength[i], strengthData[i]);
    }
    gl.uniform1f(loc.speed, CONFIG.SPEED);
    gl.uniform1f(loc.amount, CONFIG.STRENGTH);
    gl.uniform1f(loc.distortion, distortion);
    gl.uniform1f(loc.decay, CONFIG.DECAY);
    gl.uniform1f(loc.frequency, CONFIG.FREQUENCY);
    gl.uniform1f(loc.scale, scale);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function loop() {
    if (destroyed) return;
    if (!isShown(host)) {
      running = false;
      frameId = 0;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }
    const nowMs = performance.now();
    const now = nowMs * 0.001;
    prune(now);
    const moving = nowMs - lastMove < 120;
    if (!ripples.length && !moving) {
      running = false;
      frameId = 0;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }
    draw(nowMs);
    frameId = window.requestAnimationFrame(loop);
  }

  function start() {
    if (destroyed || running || !isShown(host)) return;
    running = true;
    frameId = window.requestAnimationFrame(loop);
  }

  function onPointerMove(event) {
    if (event.pointerType === "touch") return;
    const uv = localUV(event);
    const now = performance.now();
    if (!primed) {
      primed = true;
      lastX = event.clientX;
      lastY = event.clientY;
      lastMove = now;
      spawn(uv.x, uv.y, 0.32);
      start();
      return;
    }
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    const vel = Math.hypot(dx, dy);
    lastX = event.clientX;
    lastY = event.clientY;
    lastMove = now;

    if (vel > 2.4 && now - lastSpawn > 28) {
      const strength = Math.min(0.95, Math.max(0.18, (vel / 46) * CONFIG.STRENGTH));
      spawn(uv.x, uv.y, strength);
      lastSpawn = now;
    }

    start();
  }

  function onPointerEnter(event) {
    if (event.pointerType === "touch") return;
    resize();
    capture();
    primed = false;
    onPointerMove(event);
  }

  function onPointerLeave() {
    primed = false;
    start();
  }

  function onImageReady() {
    resize();
    capture();
  }

  function invalidate() {
    if (destroyed) return;
    window.requestAnimationFrame(() => {
      if (destroyed) return;
      if (resize()) capture();
      else if (isShown(host)) capture();
    });
  }

  function destroy() {
    destroyed = true;
    running = false;
    if (frameId) window.cancelAnimationFrame(frameId);
    host.removeEventListener("pointerenter", onPointerEnter);
    host.removeEventListener("pointerleave", onPointerLeave);
    host.removeEventListener("pointermove", onPointerMove);
    img?.removeEventListener("load", onImageReady);
    canvas.remove();
  }

  host.addEventListener("pointerenter", onPointerEnter);
  host.addEventListener("pointerleave", onPointerLeave);
  host.addEventListener("pointermove", onPointerMove, { passive: true });
  img?.addEventListener("load", onImageReady);

  resize();
  capture();

  return { resize: invalidate, invalidate, destroy };
}

export async function initLiquidSurface() {
  if (shouldSkip()) {
    return { invalidate() {}, destroy() {} };
  }

  let vertSrc;
  let fragSrc;
  try {
    [vertSrc, fragSrc] = await loadShaders();
  } catch {
    return { invalidate() {}, destroy() {} };
  }

  const hosts = [...document.querySelectorAll(".ripple-scope")];
  const layers = hosts.map((host) => createLayer(host, vertSrc, fragSrc)).filter(Boolean);

  const observer = new ResizeObserver(() => {
    layers.forEach((layer) => layer.invalidate());
  });
  hosts.forEach((host) => observer.observe(host));

  function onResize() {
    layers.forEach((layer) => layer.invalidate());
  }

  window.addEventListener("resize", onResize);

  return {
    invalidate() {
      layers.forEach((layer) => layer.invalidate());
    },
    destroy() {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      layers.forEach((layer) => layer.destroy());
    },
  };
}
