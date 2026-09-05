(() => {
  if (globalThis.bananaFeed) return;

  const styles = `
    :host { all: initial !important; position: fixed !important; inset: 0 !important;
      display: block !important; z-index: 2147483647 !important; pointer-events: none !important;
      contain: layout style; color-scheme: light; }
    *, *::before, *::after { box-sizing: border-box; }
    .scene { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
    canvas { display: block; width: 100%; height: 100%; }
    .friend { position: absolute; right: 24px; bottom: 98px; width: clamp(145px, 19vw, 230px);
      transform: rotate(-4deg); filter: drop-shadow(0 8px 4px #482b2125); }
    .capuchin { display: block; width: 100%; overflow: visible; }
    .monkey-body { transform-origin: 140px 250px; animation: dance .7s ease-in-out infinite alternate; }
    .monkey-arm.left { transform-origin: 104px 172px; animation: wave .7s ease-in-out infinite alternate; }
    .monkey-arm.right { transform-origin: 177px 172px; animation: wave .7s ease-in-out infinite alternate-reverse; }
    .monkey-head { transform-origin: 140px 140px; animation: nod .7s ease-in-out infinite alternate; }
    .speech { position: absolute; right: 32px; bottom: calc(100% - 12px); background: #fff9da;
      color: #482b21; border: 2px solid #482b21; border-radius: 18px 18px 2px 18px;
      padding: 10px 15px; white-space: nowrap; font: 800 16px/1.2 ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif;
      transform: rotate(4deg); }
    .dock { position: absolute; right: 24px; bottom: 22px; display: flex; align-items: center;
      gap: 8px; max-width: calc(100% - 32px); background: #ffdc45; color: #382919;
      border: 2px solid #382919; border-radius: 22px; padding: 9px;
      box-shadow: 0 5px 0 #382919, 0 10px 25px #38291925; pointer-events: auto;
      font: 700 13px/1.2 system-ui, sans-serif; }
    .brand { padding: 0 8px; display: flex; align-items: center; gap: 7px; }
    .brand svg { width: 28px; height: 28px; }
    button { appearance: none; display: inline-flex; align-items: center; justify-content: center;
      min-height: 44px; margin: 0; border: 1.5px solid #382919; padding: 10px 13px;
      border-radius: 13px; font: inherit; cursor: pointer; background: #fff9da; color: #382919;
      transition: background .15s, transform .15s; }
    button:hover { background: #fff; transform: translateY(-1px); }
    button:active { transform: translateY(1px); }
    button:focus-visible { outline: 3px solid #175640; outline-offset: 3px; }
    .more { background: #215c40; color: #fff9da; border-color: #215c40; }
    .more:hover { background: #153f2b; }
    .restore { border-color: transparent; background: transparent; }
    .paused .capuchin * { animation-play-state: paused !important; }
    @keyframes dance { from { transform: translateY(0) rotate(-5deg); } to { transform: translateY(-12px) rotate(5deg); } }
    @keyframes wave { from { transform: rotate(-12deg); } to { transform: rotate(13deg); } }
    @keyframes nod { from { transform: rotate(4deg); } to { transform: rotate(-4deg); } }
    @media (max-width: 600px) {
      .dock { right: 16px; bottom: 16px; gap: 5px; padding: 7px; }
      .brand { display: none; }
      button { padding: 9px 11px; font-size: 12px; }
      .friend { right: 15px; bottom: 94px; width: 150px; }
      .speech { font-size: 13px; right: 12px; padding: 8px 12px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .capuchin * { animation: none !important; }
      button { transition: none; }
    }
  `;

  let party = null;
  const random = (min, max) => min + Math.random() * (max - min);

  function start() {
    const host = document.createElement("banana-feed-party");
    const shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = styles;
    const scene = document.createElement("div");
    scene.className = "scene";
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Bananify needs a browser with Canvas 2D support.");
    const friend = document.createElement("div");
    friend.className = "friend";
    friend.setAttribute("aria-hidden", "true");
    const speech = document.createElement("div");
    speech.className = "speech";
    speech.textContent = "My kind of website.";
    friend.append(globalThis.bananaFeedArt.monkey(), speech);
    scene.append(canvas, friend);

    const dock = document.createElement("section");
    dock.className = "dock";
    dock.setAttribute("aria-label", "Bananify party controls");
    const brand = document.createElement("span");
    brand.className = "brand";
    brand.append(globalThis.bananaFeedArt.banana(), document.createTextNode("Banana party"));
    const button = (text, className) => {
      const node = document.createElement("button");
      node.type = "button";
      node.className = className;
      node.textContent = text;
      return node;
    };
    const more = button("More bananas", "more");
    const pause = button("Pause", "pause");
    pause.setAttribute("aria-label", "Pause banana animations");
    pause.setAttribute("aria-pressed", "false");
    const restore = button("Restore page", "restore");
    dock.append(brand, more, pause, restore);
    shadow.append(style, scene, dock);
    document.documentElement.append(host);

    const events = new AbortController();
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const banana = new Path2D(globalThis.bananaFeedArt.bananaPath);
    const shine = new Path2D("M16 22 C13 48 36 64 61 41");
    let width = 0;
    let height = 0;
    let frame = 0;
    let lastTime = 0;
    let paused = false;
    let removed = false;
    let showerCount = 42;
    let stickers = [];
    let drops = [];
    let bursts = [];

    const makeDrop = (initial = false) => ({
      x: random(0, width), y: initial ? random(-height, height) : random(-150, -50),
      size: random(24, 51), angle: random(-Math.PI, Math.PI),
      speed: random(45, 110), spin: random(-.8, .8), drift: random(-18, 18),
    });

    function drawBanana(item, opacity = 1) {
      context.save();
      context.globalAlpha = opacity;
      context.translate(item.x, item.y);
      context.rotate(item.angle);
      context.scale(item.size / 80, item.size / 80);
      context.translate(-40, -40);
      context.fillStyle = "#ffda35";
      context.strokeStyle = "#58351e";
      context.lineWidth = 3;
      context.lineJoin = "round";
      context.fill(banana);
      context.stroke(banana);
      context.strokeStyle = "#fff29b";
      context.lineWidth = 5;
      context.lineCap = "round";
      context.stroke(shine);
      context.fillStyle = "#754326";
      context.fillRect(13, 7, 6, 9);
      context.fillRect(70, 22, 6, 7);
      context.restore();
    }

    function paint() {
      context.clearRect(0, 0, width, height);
      stickers.forEach((item) => drawBanana(item, .8));
      drops.forEach((item) => drawBanana(item, .95));
      bursts.forEach((item) => drawBanana(item, Math.min(1, item.life)));
    }

    function animate(time) {
      frame = 0;
      if (removed || paused || motion.matches || document.hidden) return;
      const delta = lastTime ? Math.min((time - lastTime) / 1000, .05) : 0;
      lastTime = time;
      for (let i = 0; i < drops.length; i++) {
        const item = drops[i];
        item.y += item.speed * delta;
        item.x += item.drift * delta;
        item.angle += item.spin * delta;
        if (item.y > height + 80) drops[i] = makeDrop();
      }
      for (const item of bursts) {
        item.x += item.vx * delta;
        item.y += item.vy * delta;
        item.vy += 220 * delta;
        item.angle += item.spin * delta;
        item.life -= delta * .55;
      }
      bursts = bursts.filter((item) => item.life > 0);
      paint();
      frame = requestAnimationFrame(animate);
    }

    function syncMotion() {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      scene.classList.toggle("paused", paused || document.hidden);
      pause.textContent = paused ? "Resume" : "Pause";
      pause.setAttribute("aria-label", paused ? "Resume banana animations" : "Pause banana animations");
      pause.setAttribute("aria-pressed", String(paused));
      pause.hidden = motion.matches;
      // Author styles set display, so use an explicit inline override for hidden.
      pause.style.display = motion.matches ? "none" : "";
      paint();
      if (!paused && !motion.matches && !document.hidden) frame = requestAnimationFrame(animate);
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      stickers = Array.from({ length: Math.min(22, Math.ceil(width * height / 55000)) }, (_, index) => ({
        x: (index % 5 + random(.15, .85)) * width / 5,
        y: (Math.floor(index / 5) + random(.1, .9)) * height / Math.ceil(Math.min(22, Math.ceil(width * height / 55000)) / 5),
        size: random(40, 85), angle: random(-1, 1),
      }));
      drops = Array.from({ length: showerCount }, () => makeDrop(true));
      paint();
    }

    function burst(x, y) {
      if (motion.matches || paused) return;
      const count = Math.min(14, 90 - bursts.length);
      for (let i = 0; i < count; i++) {
        bursts.push({
          x, y, size: random(22, 43), angle: random(-3, 3),
          vx: random(-180, 180), vy: random(-270, -100), spin: random(-4, 4), life: random(1, 1.6),
        });
      }
    }

    function stop() {
      removed = true;
      cancelAnimationFrame(frame);
      events.abort();
      host.remove();
      party = null;
    }

    more.addEventListener("click", () => {
      const next = Math.min(showerCount + 18, 114);
      drops.push(...Array.from({ length: next - showerCount }, () => makeDrop(true)));
      showerCount = next;
      speech.textContent = next === 114 ? "Peak banana. No regrets." : "Yes. This is the life.";
      burst(width * .5, height * .55);
      paint();
    }, { signal: events.signal });
    pause.addEventListener("click", () => {
      paused = !paused;
      speech.textContent = paused ? "Saving my energy." : "Back to monkey business.";
      syncMotion();
    }, { signal: events.signal });
    restore.addEventListener("click", stop, { signal: events.signal });
    document.addEventListener("pointerdown", (event) => {
      if (event.composedPath().includes(host) || event.button !== 0) return;
      burst(event.clientX, event.clientY);
    }, { passive: true, signal: events.signal });
    window.addEventListener("resize", resize, { passive: true, signal: events.signal });
    document.addEventListener("visibilitychange", syncMotion, { signal: events.signal });
    motion.addEventListener("change", syncMotion, { signal: events.signal });
    window.addEventListener("pagehide", stop, { signal: events.signal });
    party = { stop, host, get paused() { return paused; } };
    resize();
    syncMotion();
  }

  globalThis.bananaFeed = Object.freeze({
    toggle() {
      if (party) party.stop();
      else start();
      return Boolean(party);
    },
    stop() { party?.stop(); },
    get active() { return Boolean(party); },
    get paused() { return Boolean(party?.paused); },
  });
})();
