import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";

let browser;
const origin = "https://bananify.invalid";
const root = new URL("../src/Bananify/Web/", import.meta.url);
before(async () => {
  // Keep the persistent browser profile inside the repository, not a temp folder.
  await mkdir("visual-studio-extension/scripts/.inspection/profile", { recursive: true });
  browser = await chromium.launchPersistentContext("visual-studio-extension/scripts/.inspection/profile", {
    headless: true,
    ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
  });
});
after(async () => browser?.close());
async function open(width, compact, reducedMotion = "no-preference") {
  const page = await browser.newPage();
  await page.setViewportSize({ width, height: compact ? 260 : 820 });
  await page.emulateMedia({ reducedMotion });
  await page.route(`${origin}/**`, async (route) => {
    const filename = new URL(route.request().url()).pathname.slice(1);
    if (!["party.html", "party.js", "party.css"].includes(filename)) return route.abort();
    const contentType = filename.endsWith("js") ? "text/javascript" : filename.endsWith("css") ? "text/css" : "text/html";
    await route.fulfill({ body: await readFile(new URL(filename, root)), contentType });
  });
  await page.addInitScript(() => {
    const bridge = new EventTarget();
    bridge.messages = [];
    bridge.postMessage = (message) => bridge.messages.push(message);
    window.chrome = window.chrome || {};
    window.chrome.webview = bridge;
  });
  await page.goto(`${origin}/party.html`);
  await page.waitForFunction(() => window.chrome.webview.messages.some((message) => message.command === "ready"));
  await send(page, { compact });
  return page;
}
async function send(page, overrides = {}) {
  await page.evaluate((values) => {
    window.chrome.webview.dispatchEvent(new MessageEvent("message", { data: {
      type: "snapshot", active: true, paused: false, visible: true, reducedMotion: false,
      compact: true, density: 5, monkey: "brown", ...values,
    } }));
  }, overrides);
}
async function native(page, data) {
  await page.evaluate((data) => window.chrome.webview.dispatchEvent(new MessageEvent("message", { data })), data);
}
async function feedback(page, text) {
  await native(page, { type: "encouragement", text });
  assert.equal(await page.locator(".message").textContent(), text);
}
async function documentVisibility(page, hidden) {
  // Model the document signal independently of the host's visible snapshot flag.
  await page.evaluate((hidden) => {
    Object.defineProperty(document, "hidden", { configurable: true, value: hidden });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: hidden ? "hidden" : "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}
const themes = [
  { type: "theme", highContrast: false, background: "#18212A", foreground: "#E1E2E3", border: "#738495",
    button: "#254667", buttonText: "#F1E2D3", focus: "#FAB123", secondary: "#354657", secondaryText: "#D1E2F3",
    hover: "#456789", hoverText: "#F2E3D4", pressed: "#123456", pressedText: "#D4E5F6", disabled: "#343536", disabledText: "#929394" },
  { type: "theme", highContrast: false, background: "#F2F3F4", foreground: "#213243", border: "#647586",
    button: "#B1C2D3", buttonText: "#142536", focus: "#A123B4", secondary: "#C2D3E4", secondaryText: "#253647",
    hover: "#A2B3C4", hoverText: "#364758", pressed: "#91A2B3", pressedText: "#475869", disabled: "#D5D6D7", disabledText: "#737475" },
];
const celebrationText = {
  save: "Save completed! One more bit of progress safely tucked away.",
  build: "Build succeeded! A whole bunch of good work.",
  more: "More bananas! Thanks for growing the bunch.",
};
function rgb(hex) {
  return `rgb(${hex.slice(1).match(/../g).map((part) => parseInt(part, 16)).join(", ")})`;
}
async function colors(locator) {
  return locator.evaluate((node) => {
    const style = getComputedStyle(node);
    return { background: style.backgroundColor, foreground: style.color, border: style.borderTopColor,
      outline: style.outlineColor, outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
}
async function assertStatic(page) {
  assert.equal(await page.locator(".banana-drop, .burst").count(), 0);
  assert.equal(await page.locator("body").evaluate((node) => node.classList.contains("celebrating")), false);
  const animations = await page.locator(".monkey-body, .monkey-arm, .monkey-head, .monkey-stage").evaluateAll((nodes) =>
    nodes.map((node) => {
      const style = getComputedStyle(node);
      return { name: style.animationName, state: style.animationPlayState };
    }));
  assert.ok(animations.length > 1);
  assert.ok(animations.every(({ name, state }) => name === "none" || state === "paused"), JSON.stringify(animations));
}
for (const [width, compact] of [[220, true], [320, true], [1100, false]]) {
  test(`party ${width}px preserves local CSP, keyboard controls and bounded animation`, async () => {
    const page = await open(width, compact);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      assert.equal(await page.locator(".party-monkey:visible").count(), 3);
      assert.equal(await page.locator(".banana-drop").count(), 28);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.getByRole("button", { name: "Choose Henry" }).focus();
      await page.keyboard.press("Enter");
      assert.deepEqual((await page.evaluate(() => window.chrome.webview.messages)).at(-1), { command: "monkey", monkey: "golden" });
      await page.getByRole("button", { name: "More bananas" }).focus();
      await page.keyboard.press("Space");
      assert.deepEqual((await page.evaluate(() => window.chrome.webview.messages)).at(-1), { command: "more" });
      await page.evaluate(() => {
        for (let i = 0; i < 100; i++) document.body.dispatchEvent(new PointerEvent("pointerdown", { button: 0, clientX: 100, clientY: 100, bubbles: true }));
      });
      assert.equal(await page.locator(".burst").count(), 30);
      await send(page, { visible: false, compact });
      assert.equal(await page.locator(".burst").count(), 0);
      assert.equal(await page.locator(".banana-drop").count(), 0);
      await send(page, { paused: true, compact });
      assert.equal(await page.getByRole("button", { name: "More bananas" }).isDisabled(), true);
      await send(page, { active: false, compact });
      assert.equal(await page.getByRole("button", { name: "Start party" }).isVisible(), true);
      await send(page, { compact, monkey: "golden" });
      await page.screenshot({ path: `visual-studio-extension/scripts/.inspection/party-${width}.png` });
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}
test("OS reduced motion cannot be overridden by a state snapshot", async () => {
  const page = await open(320, true, "reduce");
  try {
    assert.equal(await page.locator(".banana-drop").count(), 0);
    await native(page, { type: "celebrate", reason: "more" });
    assert.equal(await page.locator(".burst").count(), 0);
    assert.equal(await page.locator(".message").textContent(), `Mooch says: ${celebrationText.more}`);
    assert.equal(await page.locator(".monkey-body").first().evaluate((node) => getComputedStyle(node).animationName), "none");
  } finally { await page.close(); }
});
test("one hidden surface does not pause another", async () => {
  const compact = await open(320, true);
  const large = await open(1100, false);
  try {
    await send(compact, { visible: false });
    assert.equal(await compact.locator(".banana-drop").count(), 0);
    assert.equal(await large.locator(".banana-drop").count(), 28);
  } finally { await compact.close(); await large.close(); }
});

test("invalid native density snapshots leave the previous state untouched", async () => {
  const page = await open(320, true);
  try {
    await send(page, { density: 1 });
    assert.equal(await page.locator(".banana-drop").count(), 6);
    for (const density of [0, 6, 100, 1.5, "5"]) {
      await send(page, { density, active: false });
      assert.equal(await page.locator(".banana-drop").count(), 6);
      assert.equal(await page.getByRole("button", { name: "Pause", exact: true }).isVisible(), true);
    }
  } finally { await page.close(); }
});

for (const [width, compact] of [[320, true], [1100, false]]) {
  test(`foreground paint order survives celebration and overlays do not intercept clicks at ${width}px`, async () => {
    const page = await open(width, compact);
    const consoleErrors = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    try {
      const inspect = async (celebrate) => page.evaluate(({ celebrate, compact }) => {
        if (celebrate) window.chrome.webview.dispatchEvent(new MessageEvent("message", { data: { type: "celebrate", reason: "save" } }));
        const sky = document.querySelector(".sky");
        const bursts = document.querySelector(".bursts");
        const stage = document.querySelector(".monkey-stage");
        const selectors = [".banana-level", ".message", ".actions", ...(compact ? [] : ["h1"])];
        const nodes = [stage, ...selectors.map((selector) => document.querySelector(selector))];
        const result = {
          mainZ: getComputedStyle(document.querySelector("main")).zIndex,
          cardAnimation: getComputedStyle(document.querySelector(".party-card")).animationName,
          cardTransform: getComputedStyle(document.querySelector(".party-card")).transform,
          stageAnimation: getComputedStyle(stage).animationName,
          z: [stage, sky, bursts, ...nodes.slice(1)].map((node) => getComputedStyle(node).zIndex),
          pointerEvents: [sky, bursts].map((node) => getComputedStyle(node).pointerEvents),
        };
        const saved = [sky, bursts].map((node) => ({
          value: node.style.getPropertyValue("pointer-events"),
          priority: node.style.getPropertyPriority("pointer-events"),
        }));
        try {
          // Expose the real stacking contexts to hit testing without changing z-index,
          // geometry, transforms, animations, or any foreground styles.
          sky.style.pointerEvents = "auto";
          bursts.style.pointerEvents = "auto";
          result.paint = nodes.map((node) => {
            const rect = node.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            const painted = document.elementsFromPoint(x, y);
            return { target: node.className || node.tagName, inViewport: x >= 0 && x < innerWidth && y >= 0 && y < innerHeight,
              targetIndex: painted.indexOf(node), skyIndex: painted.indexOf(sky), burstsIndex: painted.indexOf(bursts) };
          });
        } finally {
          // Restore through CSSOM; assigning a style attribute is blocked by the page's CSP.
          [sky, bursts].forEach((node, index) => {
            if (saved[index].value) node.style.setProperty("pointer-events", saved[index].value, saved[index].priority);
            else node.style.removeProperty("pointer-events");
          });
        }
        result.restored = [sky, bursts].map((node) => getComputedStyle(node).pointerEvents);
        return result;
      }, { celebrate, compact });
      for (const celebrate of [false, true]) {
        const result = await inspect(celebrate);
        assert.equal(result.mainZ, "auto");
        assert.equal(result.cardAnimation, "none");
        assert.equal(result.cardTransform, "none");
        assert.equal(result.stageAnimation, celebrate ? "celebrate" : "none");
        assert.deepEqual(result.z, ["0", "1", "2", ...Array(compact ? 3 : 4).fill("3")]);
        assert.deepEqual(result.pointerEvents, ["none", "none"]);
        assert.deepEqual(result.restored, ["none", "none"]);
        for (const [index, paint] of result.paint.entries()) {
          assert.ok(paint.inViewport, JSON.stringify(paint));
          assert.ok(paint.targetIndex >= 0 && paint.skyIndex >= 0 && paint.burstsIndex >= 0, JSON.stringify(paint));
          assert.ok(paint.burstsIndex < paint.skyIndex, JSON.stringify(paint));
          assert.ok(index === 0 ? paint.skyIndex < paint.targetIndex : paint.targetIndex < paint.burstsIndex, JSON.stringify(paint));
        }
      }
      const controls = [
        ["Choose Henry", { command: "monkey", monkey: "golden" }],
        ["Pause", { command: "pause" }], ["More bananas", { command: "more" }],
        ["Encourage me", { command: "encourage" }], ["Restore", { command: "restore" }],
      ];
      for (const [name, expected] of controls) {
        const button = page.getByRole("button", { name, exact: true });
        await button.scrollIntoViewIfNeeded();
        assert.equal(await button.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.closest("button") === node;
        }), true, name);
        const count = await page.evaluate(() => window.chrome.webview.messages.length);
        await button.click();
        assert.deepEqual(await page.evaluate((count) => window.chrome.webview.messages.slice(count), count), [expected]);
      }
      assert.deepEqual(consoleErrors, [], "Paint inspection and cleanup must not violate CSP");
    } finally { await page.close(); }
  });
}

test("live banana levels follow every snapshot, wrap 5 to 1, and remain labeled while paused or off", async () => {
  const page = await open(320, true);
  try {
    const level = page.locator(".banana-level");
    assert.equal(await level.getAttribute("role"), "status");
    assert.equal(await level.getAttribute("aria-live"), "polite");
    for (const density of [1, 2, 3, 4, 5, 1]) {
      await send(page, { density });
      assert.equal(await level.textContent(), `Banana level: ${density}/5`);
      assert.equal(await page.locator(".banana-drop").count(), Math.min(28, density * 6));
    }
    for (const state of [{ paused: true, density: 4 }, { active: false, density: 2 }]) {
      await send(page, state);
      assert.equal(await level.textContent(), `Banana level: ${state.density}/5`);
      assert.equal(await level.isVisible(), true);
      assert.equal(await page.getByRole("button", { name: "More bananas" }).isDisabled(), true);
      assert.equal(await page.locator(".banana-drop").count(), 0);
      assert.equal(await page.getByRole("button", { name: state.paused ? "Resume" : "Start party", exact: true }).isVisible(), true);
    }
    await send(page, { density: 3 });
    await feedback(page, "Keep this feedback and the entire accepted snapshot.");
    const view = () => page.evaluate(() => ({
      classes: document.body.className, level: document.querySelector(".banana-level").textContent,
      message: document.querySelector(".message").textContent, rain: document.querySelector(".sky").childElementCount,
      choices: [...document.querySelectorAll(".monkey-choice")].map((node) => node.getAttribute("aria-pressed")),
      disabled: document.querySelector('[data-command="more"]').disabled,
      pause: document.querySelector('[data-command="pause"]').textContent,
    }));
    const before = await view();
    const invalid = [
      ...[0, 6, -1, 1.5, "5", null, NaN, Infinity].map((density) => ({ density })),
      ...["active", "paused", "visible", "reducedMotion", "compact"].flatMap((key) => [
        { [key]: "false" }, { [key]: null }, { [key]: undefined },
      ]),
      { monkey: "unknown" }, { monkey: "toString" }, { monkey: null },
    ];
    for (const values of invalid) {
      await send(page, { active: false, paused: true, visible: false, compact: false, density: 5, monkey: "golden", ...values });
      assert.deepEqual(await view(), before, JSON.stringify(values));
    }
    for (const data of [null, "snapshot", {}, { type: "snapshot" }]) {
      await native(page, data);
      assert.deepEqual(await view(), before);
    }
  } finally { await page.close(); }
});

test("keyboard encouragement posts only a command and native text is bounded and rendered literally", async () => {
  const page = await open(320, true);
  try {
    const button = page.getByRole("button", { name: "Encourage me", exact: true });
    assert.equal(await page.locator(".message").getAttribute("aria-live"), "polite");
    for (const state of [{}, { paused: true }, { active: false }]) {
      await send(page, state);
      assert.equal(await button.isEnabled(), true);
      for (const key of ["Enter", "Space"]) {
        const message = await page.locator(".message").textContent();
        const count = await page.evaluate(() => window.chrome.webview.messages.length);
        await button.focus();
        await page.keyboard.press(key);
        assert.deepEqual(await page.evaluate((count) => window.chrome.webview.messages.slice(count), count), [{ command: "encourage" }]);
        assert.equal(await page.locator(".message").textContent(), message);
        await feedback(page, `Native reply while ${JSON.stringify(state)} via ${key}`);
      }
    }
    const unsafe = '<img src=x onerror="window.encouragementExecuted=true"><script>window.encouragementExecuted=true</script>& <b>Great work</b>';
    for (const text of ["x", unsafe, "b".repeat(512)]) {
      await feedback(page, text);
      assert.equal(await page.locator(".message *").count(), 0);
      assert.equal(await page.evaluate(() => window.encouragementExecuted), undefined);
    }
    for (const text of ["", "x".repeat(513), 42, true, null, {}, ["hello"]]) {
      await native(page, { type: "encouragement", text });
      assert.equal(await page.locator(".message").textContent(), "b".repeat(512));
    }
    await native(page, { type: "encouragement" });
    assert.equal(await page.locator(".message").textContent(), "b".repeat(512));
    await send(page, { visible: false });
    const hiddenMessage = await page.locator(".message").textContent();
    await native(page, { type: "encouragement", text: "Must not arrive while host-hidden" });
    assert.equal(await page.locator(".message").textContent(), hiddenMessage);
    await send(page);
    await feedback(page, "Visible again");
    await documentVisibility(page, true);
    const documentHiddenMessage = await page.locator(".message").textContent();
    await native(page, { type: "encouragement", text: "Must not arrive while document-hidden" });
    assert.equal(await page.locator(".message").textContent(), documentHiddenMessage);
    await documentVisibility(page, false);
    await feedback(page, "Back in view");
  } finally { await page.close(); }
});

test("both feedback event types replace each other and survive unrelated synchronization", async () => {
  const page = await open(320, true);
  try {
    for (const order of [["encouragement", "celebrate"], ["celebrate", "encouragement"]]) {
      await send(page);
      let expected;
      for (const type of order) {
        expected = type === "encouragement" ? "Native encouragement wins." : `Mooch says: ${celebrationText.build}`;
        await native(page, { type, text: expected, reason: "build" });
        assert.equal(await page.locator(".message").textContent(), expected);
      }
      for (const values of [{}, { density: 1 }, { compact: false }, { reducedMotion: true }, {}]) {
        await send(page, values);
        assert.equal(await page.locator(".message").textContent(), expected);
      }
      for (const theme of [themes[0], { ...themes[1], highContrast: true }, themes[1]]) {
        await native(page, theme);
        assert.equal(await page.locator(".message").textContent(), expected);
      }
      for (const reducedMotion of ["reduce", "no-preference"]) {
        await page.emulateMedia({ reducedMotion });
        await page.waitForFunction((reduced) => document.body.classList.contains("reduced") === reduced, reducedMotion === "reduce");
        assert.equal(await page.locator(".message").textContent(), expected);
      }
      for (const forcedColors of ["active", "none"]) {
        await page.emulateMedia({ forcedColors });
        await page.waitForFunction((reduced) => document.body.classList.contains("reduced") === reduced, forcedColors === "active");
        assert.equal(await page.locator(".message").textContent(), expected);
      }
    }
  } finally { await page.close(); }
});

test("feedback resets only for lifecycle changes and never reappears on return", async () => {
  const page = await open(320, true);
  try {
    for (const type of ["encouragement", "celebrate"]) {
      for (const [change, expected] of [
        [{ active: false }, "The party is ready when you are."],
        [{ paused: true }, "Mooch is saving some energy."],
        [{ monkey: "golden" }, "Henry brought the whole bunch."],
        [{ visible: false }, "Mooch brought the whole bunch."],
      ]) {
        await send(page);
        await native(page, { type, text: "Temporary feedback", reason: "save" });
        await send(page, change);
        assert.equal(await page.locator(".message").textContent(), expected);
        if (change.visible !== false) {
          await feedback(page, "Feedback in the changed state");
          await send(page, change);
          assert.equal(await page.locator(".message").textContent(), "Feedback in the changed state");
        }
        await send(page);
        assert.equal(await page.locator(".message").textContent(), "Mooch brought the whole bunch.");
      }
      await native(page, { type, text: "Before document visibilitychange", reason: "more" });
      await documentVisibility(page, true);
      assert.equal(await page.locator(".message").textContent(), "Mooch brought the whole bunch.");
      await documentVisibility(page, false);
      assert.equal(await page.locator(".message").textContent(), "Mooch brought the whole bunch.");
      await native(page, { type, text: "Before a visible visibilitychange", reason: "build" });
      await documentVisibility(page, false);
      assert.equal(await page.locator(".message").textContent(), "Mooch brought the whole bunch.");
    }
  } finally { await page.close(); }
});

test("celebrations require a known reason and do not impose a browser-owned cooldown", async () => {
  const page = await open(320, true);
  try {
    await feedback(page, "Keep until a valid celebration");
    for (const reason of [undefined, null, "", "unknown", "SAVE", "toString", 1]) {
      await native(page, { type: "celebrate", reason });
      assert.equal(await page.locator(".message").textContent(), "Keep until a valid celebration");
      assert.equal(await page.locator(".burst").count(), 0);
      assert.equal(await page.locator("body").evaluate((node) => node.classList.contains("celebrating")), false);
    }
    // Observe all events in one browser task, before animation cleanup timers can run.
    const frames = await page.evaluate(() => ["save", "save", "build", "more", "build", "more"].map((reason) => {
      window.chrome.webview.dispatchEvent(new MessageEvent("message", { data: { type: "celebrate", reason } }));
      return { reason, text: document.querySelector(".message").textContent, bursts: document.querySelectorAll(".burst").length,
        stage: getComputedStyle(document.querySelector(".monkey-stage")).animationName,
        card: getComputedStyle(document.querySelector(".party-card")).animationName };
    }));
    frames.forEach((frame, index) => {
      assert.equal(frame.text, `Mooch says: ${celebrationText[frame.reason]}`);
      assert.equal(frame.bursts, Math.min(30, (index + 1) * 6));
      assert.equal(frame.stage, "celebrate");
      assert.equal(frame.card, "none");
    });
    for (const state of [{ paused: true }, { active: false }, { visible: false }]) {
      await send(page, state);
      const before = await page.locator(".message").textContent();
      for (const reason of Object.keys(celebrationText)) {
        await native(page, { type: "celebrate", reason });
        assert.equal(await page.locator(".message").textContent(), before);
        await assertStatic(page);
      }
    }
    await send(page);
    await documentVisibility(page, true);
    await native(page, { type: "celebrate", reason: "save" });
    assert.equal(await page.locator(".message").textContent(), "Mooch brought the whole bunch.");
    await assertStatic(page);
    await documentVisibility(page, false);
    await native(page, { type: "celebrate", reason: "save" });
    assert.equal(await page.locator(".message").textContent(), `Mooch says: ${celebrationText.save}`);
  } finally { await page.close(); }
});

for (const source of ["snapshot", "media"]) {
  test(`all celebration reasons retain text with ${source} reduced motion`, async () => {
    const page = await open(320, true, source === "media" ? "reduce" : "no-preference");
    try {
      await send(page, { reducedMotion: source === "snapshot", monkey: "black-and-white" });
      for (const [reason, text] of Object.entries(celebrationText)) {
        await native(page, { type: "celebrate", reason });
        assert.equal(await page.locator(".message").textContent(), `Sebastian says: ${text}`);
        assert.equal(await page.locator(".message").isVisible(), true);
        await assertStatic(page);
      }
    } finally { await page.close(); }
  });
}

test("live themes apply all normal, hover, pressed, disabled, and keyboard focus colors", async () => {
  const page = await open(1100, false);
  try {
    const primary = page.getByRole("button", { name: "More bananas", exact: true });
    const secondary = page.getByRole("button", { name: "Encourage me", exact: true });
    await feedback(page, "Theme changes must keep feedback.");
    for (const theme of themes) {
      await native(page, theme);
      const body = await colors(page.locator("body"));
      assert.equal(body.background, rgb(theme.background));
      assert.equal(body.foreground, rgb(theme.foreground));
      assert.equal((await colors(page.locator(".party-card"))).border, rgb(theme.border));
      assert.equal(await page.locator("html").evaluate((node) => getComputedStyle(node).colorScheme), theme === themes[0] ? "dark" : "light");
      for (const [button, background, foreground] of [
        [primary, theme.button, theme.buttonText], [secondary, theme.secondary, theme.secondaryText],
      ]) {
        await page.mouse.move(0, 0);
        const normal = await colors(button);
        assert.equal(normal.background, rgb(background));
        assert.equal(normal.foreground, rgb(foreground));
        if (button === secondary) assert.equal(normal.border, rgb(theme.border));
        await page.keyboard.press("Tab");
        await button.focus();
        assert.equal(await button.evaluate((node) => node.matches(":focus-visible")), true);
        const focused = await colors(button);
        assert.equal(focused.outline, rgb(theme.focus));
        assert.equal(focused.outlineStyle, "solid");
        assert.equal(focused.outlineWidth, "2px");
        await button.hover();
        const hovered = await colors(button);
        assert.equal(hovered.background, rgb(theme.hover));
        assert.equal(hovered.foreground, rgb(theme.hoverText));
        assert.equal(hovered.border, rgb(theme.focus));
        await page.mouse.down();
        try {
          assert.equal(await button.evaluate((node) => node.matches(":active")), true);
          const pressed = await colors(button);
          assert.equal(pressed.background, rgb(theme.pressed));
          assert.equal(pressed.foreground, rgb(theme.pressedText));
        } finally { await page.mouse.up(); }
      }
      assert.equal(await page.locator(".message").textContent(), "Theme changes must keep feedback.");
    }
    // Change the palette while each pseudo-class is held, not just between interactions.
    for (const state of ["hover", "pressed", "focus", "disabled"]) {
      await page.mouse.move(0, 0);
      await send(page, { paused: state === "disabled" });
      if (state === "focus") {
        await page.keyboard.press("Tab");
        await primary.focus();
      } else {
        await primary.hover();
      }
      if (state === "pressed") await page.mouse.down();
      try {
        for (const theme of themes) {
          await native(page, theme);
          const actual = await colors(primary);
          if (state === "focus") {
            assert.equal(await primary.evaluate((node) => node.matches(":focus-visible")), true);
            assert.equal(actual.outline, rgb(theme.focus));
            assert.equal(actual.background, rgb(theme.button));
            assert.equal(actual.foreground, rgb(theme.buttonText));
          } else {
            assert.equal(actual.background, rgb(theme[state]));
            assert.equal(actual.foreground, rgb(theme[`${state}Text`]));
            assert.equal(actual.border, rgb(state === "disabled" ? theme.border : theme.focus));
          }
          if (state === "disabled") assert.equal(await primary.isDisabled(), true);
          if (state === "pressed") assert.equal(await primary.evaluate((node) => node.matches(":active")), true);
        }
      } finally { if (state === "pressed") await page.mouse.up(); }
    }
  } finally { await page.close(); }
});

test("invalid themes are rejected atomically, including every required color and highContrast", async () => {
  const page = await open(320, true);
  try {
    const capture = () => page.evaluate(() => ({
      properties: document.documentElement.style.cssText, classes: document.body.className,
      message: document.querySelector(".message").textContent, rain: document.querySelector(".sky").childElementCount,
      level: document.querySelector(".banana-level").textContent,
      colors: [document.body, document.querySelector('[data-command="more"]'), document.querySelector('[data-command="encourage"]')].map((node) => {
        const style = getComputedStyle(node);
        return [style.backgroundColor, style.color, style.borderTopColor, style.outlineColor];
      }),
    }));
    const keys = Object.keys(themes[0]).filter((key) => !["type", "highContrast"].includes(key));
    for (const accepted of [themes[0], { ...themes[1], highContrast: true }]) {
      await native(page, accepted);
      await feedback(page, "No partial theme updates.");
      const before = await capture();
      const candidate = { ...(accepted.highContrast ? themes[0] : themes[1]), highContrast: !accepted.highContrast };
      for (const key of [...keys, "highContrast"]) {
        const missing = { ...candidate };
        delete missing[key];
        const invalidValues = key === "highContrast" ? ["true", 1, null] : ["#12345g", "#abc", null];
        for (const invalid of [missing, ...invalidValues.map((value) => ({ ...candidate, [key]: value }))]) {
          await native(page, invalid);
          assert.deepEqual(await capture(), before, `Rejected ${key}: ${JSON.stringify(invalid[key])}`);
        }
      }
      for (const background of ["red", "rgb(1, 2, 3)", "var(--background)", "#11223344", " #112233", "#112233; color:red", 123456]) {
        await native(page, { ...candidate, background });
        assert.deepEqual(await capture(), before, String(background));
      }
      await native(page, { type: "theme" });
      assert.deepEqual(await capture(), before);
    }
  } finally { await page.close(); }
});

test("host high contrast uses system colors, stays static, and restores the live palette", async () => {
  const page = await open(1100, false);
  try {
    const primary = page.getByRole("button", { name: "More bananas", exact: true });
    const secondary = page.getByRole("button", { name: "Encourage me", exact: true });
    await native(page, { ...themes[0], highContrast: true });
    // Resolve system colors in this browser instead of assuming an OS palette.
    const system = await page.evaluate(() => {
      const probe = document.createElement("span");
      document.body.append(probe);
      try {
        return Object.fromEntries(["Canvas", "CanvasText", "ButtonFace", "ButtonText", "Highlight", "HighlightText", "GrayText"].map((name) => {
          probe.style.color = name;
          return [name, getComputedStyle(probe).color];
        }));
      } finally { probe.remove(); }
    });
    assert.equal((await colors(page.locator("body"))).background, system.Canvas);
    assert.equal((await colors(page.locator("body"))).foreground, system.CanvasText);
    assert.equal((await colors(page.locator(".party-card"))).border, system.ButtonText);
    assert.equal(await page.locator(".party-card").evaluate((node) => getComputedStyle(node).boxShadow), "none");
    for (const button of [primary, secondary]) {
      await page.mouse.move(0, 0);
      const normal = await colors(button);
      assert.equal(normal.background, system.ButtonFace);
      assert.equal(normal.foreground, system.ButtonText);
      assert.equal(normal.border, system.ButtonText);
      await page.keyboard.press("Tab");
      await button.focus();
      assert.equal(await button.evaluate((node) => node.matches(":focus-visible")), true);
      const focused = await colors(button);
      assert.equal(focused.outline, system.Highlight);
      assert.equal(focused.outlineStyle, "solid");
      await button.hover();
      const hovered = await colors(button);
      assert.equal(hovered.background, system.Highlight);
      assert.equal(hovered.foreground, system.HighlightText);
      await page.mouse.down();
      try {
        const pressed = await colors(button);
        assert.equal(pressed.background, system.Highlight);
        assert.equal(pressed.foreground, system.HighlightText);
      } finally { await page.mouse.up(); }
    }
    for (const reason of Object.keys(celebrationText)) {
      await native(page, { type: "celebrate", reason });
      assert.equal(await page.locator(".message").textContent(), `Mooch says: ${celebrationText[reason]}`);
      await assertStatic(page);
    }
    await send(page, { paused: true, compact: false });
    const disabled = await colors(primary);
    assert.equal(disabled.background, system.ButtonFace);
    assert.equal(disabled.foreground, system.GrayText);
    assert.equal(disabled.border, system.ButtonText);
    await send(page, { compact: false });
    await feedback(page, "Keep feedback when restoring normal colors.");
    await native(page, themes[1]);
    await page.mouse.move(0, 0);
    assert.equal(await page.locator("body").evaluate((node) => node.classList.contains("high-contrast") || node.classList.contains("reduced")), false);
    assert.equal((await colors(page.locator("body"))).background, rgb(themes[1].background));
    assert.equal((await colors(primary)).background, rgb(themes[1].button));
    assert.equal(await page.locator(".banana-drop").count(), 28);
    assert.equal(await page.locator(".message").textContent(), "Keep feedback when restoring normal colors.");
  } finally { await page.close(); }
});

test("live forced-colors media disables motion independently of host theme and snapshot flags", async () => {
  const page = await open(1100, false);
  try {
    await native(page, themes[0]);
    await native(page, { type: "celebrate", reason: "save" });
    await page.emulateMedia({ forcedColors: "active" });
    await page.waitForFunction(() => matchMedia("(forced-colors: active)").matches && document.body.classList.contains("reduced"));
    assert.equal(await page.locator(".message").textContent(), `Mooch says: ${celebrationText.save}`);
    await assertStatic(page);
    await native(page, themes[1]);
    await send(page, { compact: false, reducedMotion: false });
    assert.equal(await page.locator("body").evaluate((node) => node.classList.contains("high-contrast")), false);
    await assertStatic(page);
    const forced = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.style.forcedColorAdjust = "none";
      document.body.append(probe);
      try {
        const resolve = (name) => { probe.style.color = name; return getComputedStyle(probe).color; };
        const body = getComputedStyle(document.body);
        const button = getComputedStyle(document.querySelector('[data-command="more"]'));
        return { background: body.backgroundColor, foreground: body.color, button: button.backgroundColor,
          buttonText: button.color, border: button.borderTopColor,
          expected: { background: resolve("Canvas"), foreground: resolve("CanvasText"), button: resolve("ButtonFace"), buttonText: resolve("ButtonText") } };
      } finally { probe.remove(); }
    });
    for (const key of ["background", "foreground", "button", "buttonText"]) assert.equal(forced[key], forced.expected[key], key);
    assert.equal(forced.border, forced.expected.buttonText);
    assert.equal(await page.locator(".party-card").evaluate((node) => getComputedStyle(node).boxShadow), "none");
    for (const reason of Object.keys(celebrationText)) {
      await native(page, { type: "celebrate", reason });
      assert.equal(await page.locator(".message").textContent(), `Mooch says: ${celebrationText[reason]}`);
      await assertStatic(page);
    }
    await page.emulateMedia({ forcedColors: "none" });
    await page.waitForFunction(() => !matchMedia("(forced-colors: active)").matches && !document.body.classList.contains("reduced"));
    assert.equal(await page.locator(".banana-drop").count(), 28);
    assert.equal((await colors(page.locator("body"))).background, rgb(themes[1].background));
    assert.equal(await page.locator(".message").textContent(), `Mooch says: ${celebrationText.more}`);
  } finally { await page.close(); }
});

for (const [width, compact] of [[160, true], [220, true], [240, true], [320, true], [220, false]]) {
  test(`long feedback and live level do not overflow at ${width}px (${compact ? "compact" : "full"})`, async () => {
    const page = await open(width, compact);
    try {
      for (const text of ["W".repeat(512), "<>&".repeat(170), `Mooch says: ${celebrationText.build}`]) {
        await feedback(page, text);
        for (const density of [5, 1]) {
          await send(page, { compact, density });
          assert.equal(await page.locator(".message").textContent(), text);
          assert.equal(await page.locator(".banana-level").textContent(), `Banana level: ${density}/5`);
          const layout = await page.evaluate(() => ({
            viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth,
            boxes: [...document.querySelectorAll(".party-card, .message, .banana-level, .actions, .actions button, .monkey-choice, .monkey-choice > span")]
              .filter((node) => node.getClientRects().length)
              .map((node) => { const rect = node.getBoundingClientRect(); return { name: node.className || node.textContent,
                left: rect.left, right: rect.right, client: node.clientWidth, scroll: node.scrollWidth }; }),
          }));
          assert.ok(layout.document <= layout.viewport && layout.body <= layout.viewport, JSON.stringify(layout));
          for (const box of layout.boxes) {
            assert.ok(box.left >= -1 && box.right <= layout.viewport + 1, JSON.stringify(box));
            assert.ok(box.scroll <= box.client + 1, JSON.stringify(box));
          }
        }
      }
      const encourage = page.getByRole("button", { name: "Encourage me", exact: true });
      await encourage.focus();
      await page.keyboard.press("Enter");
      assert.deepEqual((await page.evaluate(() => window.chrome.webview.messages)).at(-1), { command: "encourage" });
    } finally { await page.close(); }
  });
}
