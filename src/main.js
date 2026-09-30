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

const workGrid = document.querySelector(".work-grid");
const workView = document.querySelector(".work-view");
const workViewImg = workView?.querySelector(".work-view__img");
const workViewText = document.getElementById("work-view-text");
let workTileReturn = null;

function openWork(tile) {
  const source = tile.querySelector("img");
  if (!workView || !workViewImg || !source) return;
  workViewImg.src = source.src;
  workViewImg.alt = source.alt || "";
  if (workViewText) workViewText.textContent = tile.dataset.caption || "";
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
    workViewImg.removeAttribute("src");
    workViewImg.alt = "";
  }
  const back = workTileReturn;
  workTileReturn = null;
  if (options.restore !== false) back?.focus();
}

workGrid?.addEventListener("click", (event) => {
  const tile = event.target.closest(".work-tile");
  if (!tile) return;
  openWork(tile);
});

workView?.addEventListener("click", (event) => {
  if (event.target.closest(".work-view__text")) return;
  closeWork();
});

tickClock();
window.setInterval(tickClock, 1000);

initMailtoCopy();
const liquid = await initLiquidSurface();
showView(currentView());
