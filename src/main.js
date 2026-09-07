import { initLiquidSurface } from "./liquidSurface.js";

const views = ["home", "about", "projects", "shop", "contact"];
const aliases = { work: "projects", experiments: "shop" };
const links = [...document.querySelectorAll(".nav a")];
const logoLink = document.querySelector(".logo-link");
const clock = document.getElementById("clock");
const contactCta = document.querySelector(".contact-cta__link");
const contactPanel = document.getElementById("contact-panel");

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

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => copyFallback(text));
    return;
  }
  copyFallback(text);
}

function copyFallback(text) {
  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();
  try {
    document.execCommand("copy");
  } catch {
    /* ignore */
  }
  input.remove();
}

function initMailtoCopy() {
  document.querySelectorAll(".contact-email").forEach((link) => {
    link.addEventListener("click", () => {
      const href = link.getAttribute("href") || "";
      const address = decodeURIComponent(href.replace(/^mailto:/i, "")).split("?")[0];
      if (address) copyText(address);
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

tickClock();
window.setInterval(tickClock, 1000);

initMailtoCopy();
const liquid = await initLiquidSurface();
showView(currentView());
