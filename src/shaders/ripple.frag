precision highp float;

varying vec2 vUv;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uRipplePos[8];
uniform float uRippleTime[8];
uniform float uRippleStrength[8];
uniform float uSpeed;
uniform float uStrength;
uniform float uDistortion;
uniform float uDecay;
uniform float uFrequency;
uniform float uScale;

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 offset = vec2(0.0);

  for (int i = 0; i < 8; i++) {
    float live = uRippleStrength[i];
    vec2 origin = uRipplePos[i];
    vec2 delta = (uv - origin) * vec2(aspect, 1.0) * uScale;
    float dist = length(delta);
    float elapsed = max(0.0, uTime - uRippleTime[i]);
    float envelope = exp(-elapsed * uDecay) * live * uStrength;
    float travel = elapsed * uSpeed * 0.24;
    float packet = exp(-12.0 * (dist - travel) * (dist - travel));
    float spatial = exp(-dist * 5.8);
    float wave = sin(dist * uFrequency - elapsed * uSpeed * 6.2831853);
    float amp = wave * envelope * mix(spatial, packet, 0.74);
    float safe = max(dist, 0.00015);
    offset += (delta / safe) * amp;
  }

  offset.x /= aspect;
  offset *= uDistortion;

  vec2 uvR = uv + offset * 1.07;
  vec2 uvG = uv + offset;
  vec2 uvB = uv + offset * 0.93;

  vec3 displaced = vec3(
    texture2D(uTexture, uvR).r,
    texture2D(uTexture, uvG).g,
    texture2D(uTexture, uvB).b
  );

  gl_FragColor = vec4(displaced, 1.0);
}
