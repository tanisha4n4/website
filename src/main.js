import { initLiquidSurface } from "./liquidSurface.js";

const views = ["home", "about", "projects", "shop", "contact"];
const aliases = { work: "projects", experiments: "shop" };
const links = [...document.querySelectorAll(".nav a")];
const logoLink = document.querySelector(".logo-link");
const clock = document.getElementById("clock");
const contactCta = document.querySelector(".contact-cta__link");
const contactPanel = document.getElementById("contact-panel");
const header = document.querySelector(".site-header");
const navToggle = document.querySelector(".nav-toggle");
const homeView = document.getElementById("home");
const mobileQuery = window.matchMedia("(max-width: 720px)");

function closeMobileNav() {
  header?.classList.remove("is-nav-open");
  navToggle?.setAttribute("aria-expanded", "false");
}

function placeClock(view = currentView()) {
  if (!clock || !homeView) return;
  clock.hidden = view !== "home";
  if (clock.parentElement !== homeView) homeView.appendChild(clock);
}

function currentView() {
  const raw = window.location.hash.slice(1);
  const id = aliases[raw] ?? raw;
  return views.includes(id) ? id : "home";
}

function showView(id) {
  const view = views.includes(id) ? id : "home";

  views.forEach((name) => {
    const el = document.getElementById(name);
    if (!el) return;
    if (name === "contact") {
      el.hidden = view !== "home" && view !== "contact";
      return;
    }
    el.hidden = name !== view;
  });

  links.forEach((link) => {
    const target = link.getAttribute("href")?.slice(1);
    link.classList.toggle("is-active", target === view);
  });

  document.body.dataset.view = view;
  placeClock(view);
  closeMobileNav();
  closeWork({ restore: false });
  window.scrollTo(0, 0);

  liquid.invalidate();
}

function openView(id) {
  const view = views.includes(id) ? id : "home";
  showView(view);
  if (window.location.hash !== `#${view}`) {
    history.pushState(null, "", `#${view}`);
  }
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function tickClock() {
  if (!clock) return;
  const now = new Date();
  clock.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

const copiedTimers = new WeakMap();

function copyText(text) {
  // Sync copy first so it finishes during the click, before mailto navigation.
  const copied = copyFallback(text);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {
      if (!copied) copyFallback(text);
    });
  }
}

function copyFallback(text) {
  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  input.remove();
  return ok;
}

function mailtoLikelyBlocked() {
  if (typeof window.cursorBrowser !== "undefined") return true;
  const ua = navigator.userAgent || "";
  // Cursor / VS Code Simple Browser and other Electron shells: mailto can
  // trip antivirus sandbox prompts instead of opening a mail client.
  return /Electron|\bCursor\/|\bVSCode\b| Code\//i.test(ua);
}

function flashCopied(link) {
  const prev = copiedTimers.get(link);
  if (prev) window.clearTimeout(prev);
  const restoreLabel = link.getAttribute("aria-label");
  link.classList.add("is-copied");
  link.setAttribute("aria-label", "Copied hello@fournfour.in");
  copiedTimers.set(
    link,
    window.setTimeout(() => {
      link.classList.remove("is-copied");
      if (restoreLabel) link.setAttribute("aria-label", restoreLabel);
      copiedTimers.delete(link);
    }, 1500)
  );
}

function initMailtoCopy() {
  document.querySelectorAll(".contact-email").forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href") || "";
      const address = decodeURIComponent(href.replace(/^mailto:/i, "")).split("?")[0];
      if (address) copyText(address);
      flashCopied(link);
      // Keep native mailto for real browsers; skip it in the IDE sandbox.
      if (mailtoLikelyBlocked()) event.preventDefault();
    });
  });
}

links.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    openView(link.getAttribute("href")?.slice(1));
  });
});

logoLink?.addEventListener("click", (event) => {
  event.preventDefault();
  openView("home");
});

navToggle?.addEventListener("click", () => {
  if (!mobileQuery.matches) return;
  const open = !header.classList.contains("is-nav-open");
  header.classList.toggle("is-nav-open", open);
  navToggle.setAttribute("aria-expanded", open ? "true" : "false");
});

document.addEventListener("click", (event) => {
  if (!mobileQuery.matches || !header?.classList.contains("is-nav-open")) return;
  if (header.contains(event.target)) return;
  closeMobileNav();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (workView && !workView.hidden) {
    closeWork();
    return;
  }
  closeMobileNav();
});

mobileQuery.addEventListener("change", () => {
  if (!mobileQuery.matches) closeMobileNav();
  placeClock();
});

placeClock();

contactCta?.addEventListener("click", (event) => {
  event.preventDefault();
  contactPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
});

window.addEventListener("hashchange", () => {
  showView(currentView());
});

window.addEventListener("popstate", () => {
  showView(currentView());
});

const workGrids = document.querySelectorAll(".work-grid");
const workView = document.querySelector(".work-view");
const workViewImg = workView?.querySelector(".work-view__img");
const workViewStory = workView?.querySelector(".work-view__story");
const workViewCopy = workView?.querySelector(".work-view__frame > .work-view__copy");
const workViewText = document.getElementById("work-view-text");
const workViewLead = document.getElementById("work-view-lead");
const workViewTitle = document.getElementById("work-view-title");
let workTileReturn = null;

function tileCaption(tile) {
  const caption = tile.querySelector(".work-tile__caption");
  if (caption) return caption.textContent.trim();
  return tile.dataset.caption || "";
}

function setWorkLead(tile) {
  if (!workViewLead) return;
  const source = tile.querySelector(".work-tile__lead");
  workViewLead.replaceChildren();
  if (!source) {
    workViewLead.hidden = true;
    return;
  }
  workViewLead.append(...source.cloneNode(true).childNodes);
  workViewLead.hidden = false;
}

function clearStory() {
  if (workViewTitle && workViewCopy && workViewTitle.parentElement !== workViewCopy) {
    workViewCopy.append(workViewTitle);
  }
  if (!workViewStory) return;
  workViewStory.replaceChildren();
  workViewStory.hidden = true;
  workView?.classList.remove("is-story", "is-portraits");
}

function storyShot(source) {
  const shot = document.createElement(source ? "img" : "div");
  shot.className = "work-view__shot";
  if (!source) {
    shot.setAttribute("aria-hidden", "true");
    return shot;
  }
  shot.src = source.src;
  shot.alt = source.alt || "";
  shot.style.objectFit = source.dataset.fit || "cover";
  return shot;
}

function storyText(source, title) {
  const block = document.createElement("div");
  block.className = "work-view__copy";
  if (title && workViewTitle) {
    workViewTitle.textContent = title;
    workViewTitle.hidden = false;
    block.append(workViewTitle);
  }
  if (source instanceof Element && source.children.length) {
    [...source.children].forEach((child) => block.append(child.cloneNode(true)));
    return block;
  }
  const body = typeof source === "string" ? source : source?.textContent?.trim() || "";
  if (!body && !title) return null;
  const paragraph = document.createElement("p");
  paragraph.className = "work-view__text";
  paragraph.textContent = body;
  block.append(paragraph);
  return block;
}

function fillStory(tile) {
  if (!workViewStory) return;
  const title = tile.dataset.title || "";
  if (!title) {
    clearStory();
    return;
  }
  const texts = [...tile.querySelectorAll(".work-tile__text")];
  if (tile.dataset.layout === "portraits") {
    const spread = document.createElement("div");
    spread.className = "work-view__spread";
    const stack = document.createElement("div");
    stack.className = "work-view__stack";
    const column = document.createElement("div");
    column.className = "work-view__column";
    const word = tile.dataset.word || "identities";
    const identities = document.createElement("p");
    identities.className = "work-view__identities display";
    identities.dataset.text = word;
    const hires = document.createElement("span");
    hires.className = "display__hires";
    const mark = document.createElement("span");
    mark.className = "display__mark";
    mark.textContent = word;
    hires.append(mark);
    identities.append(hires);
    column.append(identities);
    clearStory();
    const dek = storyText(texts[0]);
    if (dek) {
      dek.classList.add("work-view__dek");
      column.append(dek);
    }
    const asideShots = new Map();
    tile.querySelectorAll(".work-tile__extra").forEach((img) => {
      const place = img.dataset.place || "stack";
      if (place === "d") {
        const shot = document.createElement("div");
        shot.className = "work-view__shot";
        shot.dataset.place = "d";
        const photo = document.createElement("img");
        photo.src = img.getAttribute("src");
        photo.alt = img.alt || "";
        shot.append(photo);
        column.append(shot);
        return;
      }
      const shot = storyShot({
        src: img.getAttribute("src"),
        alt: img.alt || "",
        dataset: { fit: img.dataset.fit || "cover" },
      });
      shot.dataset.place = place;
      if (img.dataset.aspect) shot.dataset.aspect = img.dataset.aspect;
      if (place === "aside") {
        const after = Number(img.dataset.after || 1);
        const group = asideShots.get(after) || [];
        group.push(shot);
        asideShots.set(after, group);
        return;
      }
      if (place === "c") column.append(shot);
      else stack.append(shot);
    });
    const aside = document.createElement("div");
    aside.className = "work-view__aside";
    texts.slice(1).forEach((block, index) => {
      const part = storyText(block);
      if (block.dataset.place === "stack") {
        if (part) stack.append(part);
        return;
      }
      if (part) aside.append(part);
      asideShots.get(index + 1)?.forEach((shot) => aside.append(shot));
    });
    if (aside.childElementCount) column.append(aside);
    spread.append(stack, column);
    workViewStory.append(spread);
    workView?.classList.add("is-portraits", "is-story");
    workViewStory.hidden = false;
    return;
  }
  const cover = tile.querySelector("img:not(.work-tile__extra)");
  const extras = [...tile.querySelectorAll(".work-tile__extra")];
  const sources = (slot) =>
    extras
      .filter((img) => (img.dataset.slot || "small") === slot)
      .map((img) => ({
        src: img.getAttribute("src"),
        alt: img.alt || "",
        dataset: { fit: img.dataset.fit || "cover" },
      }));
  const opening = sources("open");
  const smalls = sources("small");
  const closing = sources("close");
  const nextSmall = () => (smalls.length ? storyShot(smalls.shift()) : storyShot());
  const motion = tile.dataset.motion
    ? {
        src: tile.dataset.motion,
        alt: tile.dataset.motionAlt || cover?.alt || "",
        dataset: { fit: "contain" },
      }
    : null;
  const pair = document.createElement("div");
  pair.className = "work-view__pair";
  const smallShots = [motion ? storyShot(motion) : nextSmall(), nextSmall()];
  smallShots.forEach((shot) => shot.classList.add("work-view__shot--small"));
  pair.append(...smallShots);
  clearStory();
  const sequence = [
    opening.length ? storyShot(opening.shift()) : storyShot(cover),
    storyText(texts[0], title),
    pair,
    storyText(texts[1]),
    closing.length ? storyShot(closing.shift()) : storyShot(),
  ];
  if (texts[2]) sequence.push(storyText(texts[2]));
  workViewStory.append(...sequence.filter(Boolean));
  workViewStory.hidden = false;
  workView?.classList.add("is-story");
}

function openWork(tile) {
  const source = tile.querySelector("img");
  if (!workView || !workViewImg) return;
  if (source?.getAttribute("src")) {
    workViewImg.hidden = false;
    workViewImg.src = source.src;
    workViewImg.alt = source.alt || "";
    workViewImg.style.objectFit = source.dataset.fit || "";
  } else {
    workViewImg.hidden = true;
    workViewImg.removeAttribute("src");
    workViewImg.alt = "";
    workViewImg.style.objectFit = "";
  }
  const title = tile.dataset.title || "";
  if (workViewText) workViewText.textContent = tileCaption(tile);
  if (workViewTitle) {
    workViewTitle.textContent = title;
    workViewTitle.hidden = !title;
  }
  workView.classList.toggle("is-project", Boolean(title));
  fillStory(tile);
  workView.setAttribute("aria-labelledby", title ? "work-view-title" : "work-view-text");
  setWorkLead(tile);
  workView.hidden = false;
  document.body.classList.add("is-work-open");
  workTileReturn = tile;
  workView.focus();
}

function closeWork(options = {}) {
  if (!workView || workView.hidden) return;
  workView.hidden = true;
  document.body.classList.remove("is-work-open");
  if (workViewImg) {
    workViewImg.hidden = false;
    workViewImg.removeAttribute("src");
    workViewImg.alt = "";
    workViewImg.style.objectFit = "";
  }
  workView.classList.remove("is-project");
  clearStory();
  workView.setAttribute("aria-labelledby", "work-view-text");
  if (workViewTitle) {
    workViewTitle.textContent = "";
    workViewTitle.hidden = true;
  }
  if (workViewLead) {
    workViewLead.replaceChildren();
    workViewLead.hidden = true;
  }
  const back = workTileReturn;
  workTileReturn = null;
  if (options.restore !== false) back?.focus();
}

workGrids.forEach((grid) => {
  grid.addEventListener("click", (event) => {
    const tile = event.target.closest(".work-tile");
    if (!tile) return;
    openWork(tile);
  });
});

workView?.addEventListener("click", (event) => {
  if (event.target.closest(".work-view__photo, .work-view__copy, .work-view__story")) return;
  closeWork();
});

tickClock();
window.setInterval(tickClock, 1000);

initMailtoCopy();
const liquid = await initLiquidSurface();
showView(currentView());
