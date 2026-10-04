(() => {
  if (globalThis.bananaFeed) return;

  const styles = `
    :host { all: initial !important; position: fixed !important; inset: 0 !important;
      display: block !important; z-index: 2147483647 !important; pointer-events: none !important;
      contain: layout style; color-scheme: light; }
    *, *::before, *::after { box-sizing: border-box; }
    .scene { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
    canvas { display: block; width: 100%; height: 100%; }
    .friend { position: absolute; left: 0; top: 0; width: clamp(145px, 19vw, 230px);
      filter: drop-shadow(0 8px 4px #482b2125); will-change: transform; }
    .capuchin { display: block; width: 100%; overflow: visible; transform-origin: 50% 93%;
      transform: scaleX(var(--face, 1)) rotate(var(--lean, -4deg)); transition: transform .18s ease-out; }
    .monkey-body { transform-origin: 140px 250px; animation: dance .7s ease-in-out infinite alternate; }
    .monkey-arm.left { transform-origin: 104px 172px; animation: wave .7s ease-in-out infinite alternate; }
    .monkey-arm.right { transform-origin: 177px 172px; animation: wave .7s ease-in-out infinite alternate-reverse; }
    .monkey-head { transform-origin: 140px 140px; animation: nod .7s ease-in-out infinite alternate; }
    .monkey-leg.left { transform-origin: 122px 222px; }
    .monkey-leg.right { transform-origin: 166px 222px; }
    .monkey-tail { transform-origin: 186px 210px; }
    .monkey-mouth { transform-origin: 139px 135px; }
    .friend[data-mode="walk"] { --gait: .28s; }
    .friend[data-mode="run"] { --gait: .16s; }
    .friend:is([data-mode="walk"], [data-mode="run"]) .monkey-body { animation: scamper var(--gait) ease-in-out infinite alternate; }
    .friend:is([data-mode="walk"], [data-mode="run"]) .monkey-leg.left { animation: stride var(--gait) ease-in-out infinite alternate; }
    .friend:is([data-mode="walk"], [data-mode="run"]) .monkey-leg.right { animation: stride var(--gait) ease-in-out infinite alternate-reverse; }
    .friend:is([data-mode="walk"], [data-mode="run"]) .monkey-tail { animation: swish calc(var(--gait) * 2) ease-in-out infinite alternate; }
    .friend:is([data-mode="jump"], [data-mode="eat"]) .monkey-body { animation: none; }
    .friend:is([data-mode="jump"], [data-mode="eat"], [data-mode="nap"]) :is(.monkey-arm, .monkey-head) { animation: none; }
    .friend[data-mode="jump"] .monkey-arm.left { transform: rotate(12deg); }
    .friend[data-mode="jump"] .monkey-arm.right { transform: rotate(-12deg); }
    .friend[data-mode="jump"] .monkey-leg.left { transform: rotate(20deg); }
    .friend[data-mode="jump"] .monkey-leg.right { transform: rotate(-20deg); }
    .friend[data-mode="eat"] .monkey-head { animation: munch .17s ease-in-out infinite alternate; }
    .friend[data-mode="eat"] .monkey-arm.right { transform: rotate(-24deg); }
    .friend[data-mode="eat"] .monkey-mouth { animation: chew .17s ease-in-out infinite alternate; }
    .friend[data-mode="nap"] .monkey-body { animation: breathe 2.4s ease-in-out infinite alternate; }
    .friend[data-mode="nap"] .monkey-head { transform: rotate(11deg) translateY(7px); }
    .friend[data-mode="nap"] .monkey-arm.left { transform: rotate(-105deg); }
    .friend[data-mode="nap"] .monkey-arm.right { transform: rotate(105deg); }
    .friend[data-mode="nap"] .monkey-mouth { transform: scale(.4, .3); }
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
    @keyframes scamper { from { transform: translateY(0) rotate(-3deg); } to { transform: translateY(-9px) rotate(3deg); } }
    @keyframes stride { from { transform: rotate(-16deg); } to { transform: rotate(16deg); } }
    @keyframes swish { from { transform: rotate(-9deg); } to { transform: rotate(9deg); } }
    @keyframes munch { from { transform: translateY(0) rotate(-2deg); } to { transform: translateY(5px) rotate(2deg); } }
    @keyframes chew { from { transform: scaleY(1); } to { transform: scaleY(.35); } }
    @keyframes breathe { from { transform: scale(1); } to { transform: scale(1.025, .975); } }
    @media (max-width: 600px) {
      .dock { right: 16px; bottom: 16px; gap: 5px; padding: 7px; }
      .brand { display: none; }
      button { padding: 9px 11px; font-size: 12px; }
      .friend { width: 150px; }
      .speech { font-size: 13px; right: 12px; padding: 8px 12px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .capuchin { transition: none; }
      .capuchin * { animation: none !important; }
      button { transition: none; }
    }
  `;

  let party = null;
  let lastMonkey;
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
    let monkeyVariant = globalThis.bananaFeedArt.chooseMonkey(lastMonkey);
    lastMonkey = monkeyVariant;
    friend.append(globalThis.bananaFeedArt.monkey(monkeyVariant), speech);
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
    let layoutFrame = 0;
    const disguises = new Map();
    const gravity = 1800;
    const leans = { idle: -4, walk: -7, run: -11, jump: -4, eat: 0, nap: 5 };
    const snackLines = ["Got it.", "Delicious.", "Worth the run.", "That's my limit."];
    const monkey = { x: 0, feet: 0, vy: 0, face: 1, grounded: true, moving: false, placed: false,
      mode: "idle", timer: 0, goal: 0, fast: false, cheer: false, target: null, snacks: 0 };
    const stage = { width: 0, floor: 0, ledge: null, size: 0 };
    let speechHold = 0;
    let speechBox = null;
    const protectedElements = "a,button,input,textarea,select,label,form,nav,header,footer,summary,pre,code,[contenteditable]:not([contenteditable='false']),[tabindex],[role='button'],[role='link'],[role='navigation'],[role='menu'],[role='dialog'],[role='alertdialog'],[role='status'],[role='alert'],[aria-live],[aria-hidden='true'],[hidden],[inert],[data-bananify-protect]";

    function requestPaint() {
      if (removed || layoutFrame || frame || document.hidden) return;
      layoutFrame = requestAnimationFrame(() => {
        layoutFrame = 0;
        paint();
      });
    }

    const layoutObserver = new ResizeObserver(requestPaint);
    const contentObserver = new MutationObserver(() => {
      if (!host.isConnected) stop();
      else requestPaint();
    });

    function ownsOpacity(node) {
      return node.style.getPropertyValue("opacity") === "0" && node.style.getPropertyPriority("opacity") === "important";
    }

    function restoreElement(node, original) {
      if (ownsOpacity(node)) {
        if (original.opacity) node.style.setProperty("opacity", original.opacity, original.priority);
        else node.style.removeProperty("opacity");
        if (!original.hadStyle && node.style.length === 0) {
          // Flush lazy CSSOM serialization so removing the attribute stays permanent.
          node.getAttribute("style");
          node.removeAttribute("style");
        }
      }
      layoutObserver.unobserve(node);
      disguises.delete(node);
    }

    function disguiseElements(count) {
      if (!document.body || disguises.size >= 12) return;
      const candidates = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      let visited = 0;
      let node;
      while ((node = walker.nextNode()) && visited++ < 2500 && candidates.length < 200) {
        const image = node.localName === "img" || (node.localName === "svg" && !node.ownerSVGElement);
        const text = /^(p|span|li|h2|h3|figcaption)$/.test(node.localName)
          && node.childElementCount === 0 && node.textContent.trim().length > 0 && node.textContent.trim().length <= 140;
        if ((!image && !text) || disguises.has(node) || node.closest(protectedElements)) continue;
        if (node.contains(document.activeElement) || node.getClientRects().length !== 1) continue;
        const rect = node.getBoundingClientRect();
        if (rect.width < 20 || rect.height < 12 || rect.width > width * .85 || rect.height > height * .5
          || rect.bottom <= 0 || rect.top >= height || rect.right <= 0 || rect.left >= width) continue;
        const computed = getComputedStyle(node);
        if (computed.visibility !== "visible" || Number(computed.opacity) === 0) continue;
        candidates.push(node);
      }
      const total = Math.min(count, candidates.length, 12 - disguises.size);
      for (let index = 0; index < total; index++) {
        const chosen = index + Math.floor(Math.random() * (candidates.length - index));
        [candidates[index], candidates[chosen]] = [candidates[chosen], candidates[index]];
        const target = candidates[index];
        disguises.set(target, {
          opacity: target.style.getPropertyValue("opacity"),
          priority: target.style.getPropertyPriority("opacity"),
          hadStyle: target.hasAttribute("style"),
        });
        target.style.setProperty("opacity", "0", "important");
        layoutObserver.observe(target);
      }
    }

    function paintDisguises() {
      for (const [node, original] of disguises) {
        // If the site changes or removes an element, yield without resurrecting old DOM.
        if (!node.isConnected || !ownsOpacity(node) || node.closest(protectedElements)) {
          restoreElement(node, original);
          continue;
        }
        const rect = node.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= height || rect.right <= 0 || rect.left >= width) continue;
        drawBanana({
          x: rect.left + rect.width / 2, y: rect.top + rect.height / 2,
          size: Math.min(130, rect.width, rect.height * 1.6), angle: -.22,
        });
      }
    }

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
      paintDisguises();
    }

    // Control messages hold the bubble for a moment so roaming chatter cannot replace them.
    function say(text, hold = 0) {
      if (!hold && speechHold > 0) return;
      speech.textContent = text;
      speechHold = hold;
      speechBox = null;
    }

    // The monkey stands on the control dock where it overlaps it, and on the viewport floor elsewhere.
    function groundAt(x) {
      const { ledge, size } = stage;
      return ledge && x + size * .2 > ledge.left && x - size * .2 < ledge.right ? ledge.top - 2 : stage.floor;
    }

    const clampX = (x) => Math.max(stage.size / 2, Math.min(stage.width - stage.size / 2, x));

    function rest(seconds) {
      Object.assign(monkey, { mode: "idle", timer: seconds, target: null });
    }

    function goHome() {
      monkey.x = clampX(stage.ledge.right - stage.size / 2);
      Object.assign(monkey, { feet: groundAt(monkey.x), vy: 0, face: 1, grounded: true, moving: false, placed: true });
      rest(2.2);
    }

    function measure() {
      const box = scene.getBoundingClientRect();
      const dockBox = dock.getBoundingClientRect();
      stage.width = box.width;
      stage.floor = box.height - 6;
      stage.size = friend.offsetWidth;
      stage.ledge = { left: dockBox.left - box.left, right: dockBox.right - box.left, top: dockBox.top - box.top };
      speechBox = null;
      if (!monkey.placed || motion.matches) goHome();
      monkey.x = clampX(monkey.x);
      placeMonkey();
    }

    function placeMonkey() {
      const { size } = stage;
      const left = monkey.x - size / 2;
      friend.style.transform = `translate3d(${left.toFixed(1)}px, ${(monkey.feet - size * .94).toFixed(1)}px, 0)`;
      const pose = monkey.mode === "eat" || monkey.mode === "nap" ? monkey.mode
        : !monkey.grounded ? "jump" : monkey.moving ? (monkey.fast ? "run" : "walk") : "idle";
      if (friend.dataset.mode !== pose) {
        friend.dataset.mode = pose;
        friend.style.setProperty("--lean", `${leans[pose]}deg`);
      }
      if (friend.style.getPropertyValue("--face") !== String(monkey.face)) friend.style.setProperty("--face", monkey.face);
      speechBox ??= { left: speech.offsetLeft, top: speech.offsetTop };
      // Keep the bubble readable when the monkey reaches the left edge or jumps near the top.
      const nudge = Math.max(0, 8 - (left + speechBox.left));
      const drop = Math.max(0, 8 - (monkey.feet - size * .94 + speechBox.top));
      speech.style.transform = `translate(${nudge.toFixed(1)}px, ${drop.toFixed(1)}px) rotate(4deg)`;
    }

    function leap(rise) {
      if (!monkey.grounded) return;
      monkey.vy = -Math.sqrt(2 * gravity * rise);
      monkey.grounded = false;
    }

    function travel(goal, speed, delta) {
      const distance = goal - monkey.x;
      if (Math.abs(distance) < .5) return true;
      monkey.face = distance < 0 ? 1 : -1;
      const next = monkey.x + Math.sign(distance) * Math.min(Math.abs(distance), speed * delta);
      const rise = monkey.feet - groundAt(next);
      if (rise > 8) {
        // The dock is in the way: jump, and only move over it once the feet clear its top.
        leap(rise + stage.size * .15);
        return false;
      }
      monkey.x = next;
      monkey.moving = true;
      return false;
    }

    function walkTo(goal, fast = false, cheer = false) {
      Object.assign(monkey, { mode: "walk", goal: clampX(goal), fast, cheer, target: null });
      monkey.timer = Math.abs(monkey.goal - monkey.x) / (stage.size * (fast ? 1.5 : .55)) + 2;
    }

    function pickDrop() {
      const { size } = stage;
      const hands = monkey.feet - size * .68;
      const reachable = drops.filter((drop) => {
        const eta = (hands - drop.y) / drop.speed;
        const aim = drop.x + drop.drift * eta;
        return drop.y > 0 && eta > .5 && eta < 5 && aim > size / 2 && aim < stage.width - size / 2
          && Math.abs(aim - monkey.x) < size * 1.2 * eta;
      });
      return reachable[Math.floor(Math.random() * reachable.length)] ?? null;
    }

    function decide() {
      if (monkey.snacks >= 4) {
        Object.assign(monkey, { mode: "nap", timer: random(4, 6.5) });
        say("Banana nap. Zzz.");
        return;
      }
      const roll = Math.random();
      const drop = roll < .7 ? pickDrop() : null;
      if (drop) Object.assign(monkey, { mode: "chase", target: drop, timer: 7, fast: true });
      else if (roll < .9) walkTo(monkey.x + random(-3, 3) * stage.size);
      else rest(random(1.2, 2.6));
    }

    function chase(delta) {
      const { size } = stage;
      const drop = monkey.target;
      const hands = monkey.feet - size * .68;
      const eta = (hands - drop.y) / drop.speed;
      if (monkey.timer <= 0 || eta < -.4 || !drops.includes(drop)) {
        rest(random(.3, .8));
        return;
      }
      const aim = clampX(drop.x + drop.drift * Math.max(0, eta));
      travel(aim, size * 1.5, delta);
      const above = hands - drop.y;
      if (Math.hypot(drop.x - monkey.x, above) < size * .3 + drop.size / 2) {
        drops[drops.indexOf(drop)] = makeDrop();
        monkey.snacks += 1;
        Object.assign(monkey, { mode: "eat", timer: 1.1, target: null });
        say(snackLines[(monkey.snacks - 1) % snackLines.length]);
      } else if (Math.abs(aim - monkey.x) < size * .25 && above > size * .2 && above < size * .75) {
        leap(size * .4);
      }
    }

    function attract(x) {
      if (motion.matches || paused || monkey.mode === "eat") return;
      if (monkey.mode === "nap") monkey.snacks = 0;
      say(monkey.mode === "nap" ? "I was resting my eyes." : "Ooh. Over there.");
      walkTo(x, true, true);
    }

    function stepMonkey(delta) {
      speechHold = Math.max(0, speechHold - delta);
      monkey.moving = false;
      monkey.timer -= delta;
      if (monkey.mode === "idle") {
        if (monkey.timer <= 0 && monkey.grounded) decide();
      } else if (monkey.mode === "walk") {
        if (travel(monkey.goal, stage.size * (monkey.fast ? 1.5 : .55), delta) || monkey.timer <= 0) {
          if (monkey.cheer) leap(stage.size * .25);
          rest(random(.5, 1.6));
        }
      } else if (monkey.mode === "chase") {
        chase(delta);
      } else if (monkey.timer <= 0) {
        if (monkey.mode === "nap") {
          monkey.snacks = 0;
          say("I was resting my eyes.");
        }
        rest(random(.4, 1));
      }
      const ground = groundAt(monkey.x);
      if (!monkey.grounded || monkey.feet < ground) {
        monkey.vy += gravity * delta;
        monkey.feet += monkey.vy * delta;
        monkey.grounded = monkey.vy >= 0 && monkey.feet >= ground;
      }
      if (monkey.grounded) {
        monkey.feet = ground;
        monkey.vy = 0;
      }
      placeMonkey();
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
      stepMonkey(delta);
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
      measure();
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
      measure();
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
      cancelAnimationFrame(layoutFrame);
      contentObserver.disconnect();
      layoutObserver.disconnect();
      for (const [node, original] of disguises) restoreElement(node, original);
      events.abort();
      host.remove();
      party = null;
    }

    more.addEventListener("click", () => {
      const next = Math.min(showerCount + 18, 114);
      drops.push(...Array.from({ length: next - showerCount }, () => makeDrop(true)));
      showerCount = next;
      monkeyVariant = globalThis.bananaFeedArt.chooseMonkey(monkeyVariant);
      lastMonkey = monkeyVariant;
      friend.querySelector(".capuchin").replaceWith(globalThis.bananaFeedArt.monkey(monkeyVariant));
      disguiseElements(3);
      say(next === 114 ? "Peak banana. No regrets." : "Yes. This is the life.", 3);
      burst(width * .5, height * .55);
      if (!motion.matches && !paused) leap(stage.size * .25);
      placeMonkey();
      paint();
    }, { signal: events.signal });
    pause.addEventListener("click", () => {
      paused = !paused;
      say(paused ? "Saving my energy." : "Back to monkey business.", 3);
      syncMotion();
    }, { signal: events.signal });
    restore.addEventListener("click", stop, { signal: events.signal });
    document.addEventListener("pointerdown", (event) => {
      if (event.composedPath().includes(host) || event.button !== 0) return;
      burst(event.clientX, event.clientY);
      attract(event.clientX);
    }, { passive: true, signal: events.signal });
    window.addEventListener("resize", resize, { passive: true, signal: events.signal });
    document.addEventListener("scroll", requestPaint, { capture: true, passive: true, signal: events.signal });
    document.addEventListener("visibilitychange", syncMotion, { signal: events.signal });
    motion.addEventListener("change", syncMotion, { signal: events.signal });
    window.addEventListener("pagehide", stop, { signal: events.signal });
    party = { stop, host, get paused() { return paused; }, get monkeyVariant() { return monkeyVariant; } };
    resize();
    disguiseElements(4);
    if (document.body) {
      layoutObserver.observe(document.body);
    }
    contentObserver.observe(document.documentElement, { childList: true, characterData: true, attributes: true, subtree: true });
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
    get monkeyVariant() { return party?.monkeyVariant ?? null; },
  });
})();
