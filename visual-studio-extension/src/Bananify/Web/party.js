"use strict";

(() => {
  const bridge = window.chrome?.webview;
  const TRUSTED_ORIGIN = "https://bananify.invalid";
  if (!bridge || location.origin !== TRUSTED_ORIGIN) return;
  const body = document.body;
  const sky = document.querySelector(".sky");
  const bursts = document.querySelector(".bursts");
  const template = document.querySelector("#banana-template");
  const message = document.querySelector(".message");
  const pause = document.querySelector('[data-command="pause"]');
  const more = document.querySelector('[data-command="more"]');
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const events = new AbortController();
  const timers = new Map();
  const names = { brown: "Mooch", "black-and-white": "Sebastian", golden: "Henry" };
  const MAX_RAIN = 28;
  const MAX_BURSTS = 30;
  let state = { active: false, paused: false, visible: false, reducedMotion: true, density: 0, monkey: "brown" };
  let celebrationTimer;

  function clearBursts() {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    bursts.replaceChildren();
    clearTimeout(celebrationTimer);
    body.classList.remove("celebrating");
  }
  function running() { return state.active && !state.paused && state.visible && !document.hidden; }
  function reduced() { return state.reducedMotion || motion.matches; }
  function sync() {
    body.classList.toggle("active", state.active);
    body.classList.toggle("paused", state.paused);
    body.classList.toggle("hidden", !state.visible || document.hidden);
    body.classList.toggle("reduced", reduced());
    pause.textContent = state.paused ? "Resume" : "Pause";
    more.disabled = !running();
    document.querySelectorAll(".monkey-choice").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.monkey === state.monkey));
    });
    message.textContent = state.active
      ? names[state.monkey] + (state.paused ? " is saving some energy." : " brought the whole bunch.")
      : "The party is ready when you are.";
    if (!running() || reduced()) clearBursts();
    const count = running() && !reduced() ? Math.min(MAX_RAIN, Math.max(0, state.density) * 6) : 0;
    while (sky.childElementCount > count) sky.lastElementChild.remove();
    while (sky.childElementCount < count) {
      const i = sky.childElementCount;
      const drop = document.createElement("span");
      drop.className = `banana-drop variety-${i % 3}`;
      const compact = body.classList.contains("compact");
      const values = { x: (i * 37) % 101, delay: `${-((i * .43) % 8)}s`, duration: `${5.8 + i % 7 * .47}s`,
        drift: `${(i % 2 ? 1 : -1) * (18 + i % 5 * 9)}px`, size: `${(24 + i % 6 * 5) * (compact ? .55 : 1)}px` };
      for (const [key, value] of Object.entries(values)) drop.style.setProperty(`--${key}`, value);
      drop.append(template.content.firstElementChild.cloneNode(true));
      sky.append(drop);
    }
  }
  function burst(x, y) {
    if (!running()) return;
    if (reduced()) {
      message.textContent = names[state.monkey] + " says: a whole bunch of thanks!";
      return;
    }
    const compact = body.classList.contains("compact");
    const count = compact ? 6 : 10;
    for (let i = 0; i < count; i++) {
      while (bursts.childElementCount >= MAX_BURSTS) {
        const oldest = bursts.firstElementChild;
        clearTimeout(timers.get(oldest));
        timers.delete(oldest);
        oldest.remove();
      }
      const element = document.createElement("span");
      const angle = -Math.PI * .9 + Math.PI * .8 * i / (count - 1);
      const distance = (42 + i * 19 % 54) * (compact ? .6 : 1);
      const size = (compact ? 14 : 22) + i % 4 * 3;
      element.className = "burst";
      const values = { x: `${Math.max(0, Math.min(innerWidth - size, x - size / 2))}px`,
        y: `${Math.max(0, Math.min(innerHeight - size, y - size / 2))}px`,
        dx: `${Math.cos(angle) * distance}px`, dy: `${Math.sin(angle) * distance}px`,
        spin: `${(i % 2 ? 1 : -1) * (90 + i * 23)}deg`, size: `${size}px` };
      for (const [key, value] of Object.entries(values)) element.style.setProperty(`--${key}`, value);
      element.append(template.content.firstElementChild.cloneNode(true));
      bursts.append(element);
      timers.set(element, setTimeout(() => { timers.delete(element); element.remove(); }, 850));
    }
  }
  function receive({ data }) {
    if (!data || typeof data !== "object") return;
    if (data.type === "snapshot") {
      if (!["active", "paused", "visible", "reducedMotion", "compact"].every((key) => typeof data[key] === "boolean")
        || !Object.hasOwn(names, data.monkey) || !Number.isInteger(data.density) || data.density < 1 || data.density > 5) return;
      state = data;
      body.classList.toggle("compact", data.compact);
      sync();
    } else if (data.type === "theme") {
      const keys = ["background", "foreground", "border", "button", "buttonText", "focus", "secondary"];
      if (!keys.every((key) => typeof data[key] === "string" && /^#[0-9a-f]{6}$/i.test(data[key]))) return;
      for (const key of keys) document.documentElement.style.setProperty(`--${key === "buttonText" ? "button-text" : key}`, data[key]);
    } else if (data.type === "celebrate" && running()) {
      const rect = document.querySelector(".monkey-stage").getBoundingClientRect();
      burst(rect.left + rect.width / 2, rect.top + rect.height / 2);
      if (!reduced() && !body.classList.contains("celebrating")) {
        body.classList.add("celebrating");
        celebrationTimer = setTimeout(() => body.classList.remove("celebrating"), 700);
      }
    }
  }
  bridge.addEventListener("message", receive);
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    if (Object.hasOwn(names, button.dataset.monkey || "")) {
      bridge.postMessage({ command: "monkey", monkey: button.dataset.monkey });
    } else if (["start", "pause", "more", "restore"].includes(button.dataset.command)) {
      bridge.postMessage({ command: button.dataset.command });
    }
  }, { signal: events.signal });
  document.addEventListener("pointerdown", (event) => {
    if (event.button === 0 && !event.target.closest("button")) burst(event.clientX, event.clientY);
  }, { signal: events.signal });
  document.addEventListener("visibilitychange", sync, { signal: events.signal });
  motion.addEventListener("change", sync, { signal: events.signal });
  window.addEventListener("pagehide", () => {
    events.abort();
    bridge.removeEventListener("message", receive);
    clearBursts();
    sky.replaceChildren();
  }, { once: true });
  bridge.postMessage({ command: "ready" });
})();
