(() => {
  if (globalThis.bananaFeedArt) return;
  const namespace = "http://www.w3.org/2000/svg";
  const bananaPath = "M19 12 C24 39 44 50 68 25 L73 29 C63 66 28 77 13 50 C6 37 8 24 14 13 Z";
  const palettes = {
    brown: { name: "Brown capuchin", fur: "#765039", face: "#f6dab0", hands: "#efca91", ink: "#482b21", blush: "#e8ab81", crown: "#765039" },
    "black-and-white": { name: "Black-and-white capuchin", fur: "#303334", face: "#faf8ed", hands: "#e9dfcb", ink: "#191e20", blush: "#dfc6ba", crown: "#303334" },
    golden: { name: "Golden monkey", fur: "#c39137", face: "#fff0cb", hands: "#edba55", ink: "#50351f", blush: "#e5a26c", crown: "#7c8065" },
  };
  const monkeyVariants = Object.freeze(Object.keys(palettes));

  function chooseMonkey(previous) {
    const choices = monkeyVariants.filter((variant) => variant !== previous);
    return choices[Math.floor(Math.random() * choices.length)];
  }

  function element(tag, attributes = {}, children = []) {
    const node = document.createElementNS(namespace, tag);
    for (const [name, value] of Object.entries(attributes)) {
      node.setAttribute(name, value);
    }
    node.append(...children);
    return node;
  }

  function banana() {
    return element("svg", { viewBox: "0 0 80 80", width: 80, height: 80, "aria-hidden": "true" }, [
      element("path", { d: bananaPath, fill: "#ffda35", stroke: "#58351e", "stroke-width": 3, "stroke-linejoin": "round" }),
      element("path", { d: "M16 22 C13 48 36 64 61 41", fill: "none", stroke: "#fff29b", "stroke-width": 5, "stroke-linecap": "round" }),
      element("path", { d: "M14 13 L14 7 L19 7 L20 15 M68 25 L73 22 L76 27 L73 30", fill: "#754326", stroke: "#58351e", "stroke-width": 2 }),
    ]);
  }

  function monkey(variant = "brown") {
    const palette = palettes[variant];
    if (!palette) throw new RangeError(`Unknown monkey variant: ${variant}`);
    const colors = {
      "#765039": palette.fur, "#f6dab0": palette.face, "#efca91": palette.hands,
      "#482b21": palette.ink, "#e8ab81": palette.blush,
    };
    const paint = (color) => colors[color] ?? color;
    const path = (d, fill, extra = {}) => element("path", {
      d, fill: paint(fill), "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round",
      ...extra, stroke: paint(extra.stroke ?? "#482b21"),
    });
    const ellipse = (cx, cy, rx, ry, fill, extra = {}) => element("ellipse", {
      cx, cy, rx, ry, fill: paint(fill), ...extra, ...(extra.stroke ? { stroke: paint(extra.stroke) } : {}),
    });
    const svg = element("svg", {
      viewBox: "0 0 280 280", "aria-hidden": "true", class: "capuchin",
      "data-monkey": variant, "data-monkey-name": palette.name,
    });
    const body = element("g", { class: "monkey-body" }, [
      path("M185 209 C258 240 276 171 245 159 C227 151 216 171 232 179", "none", { "stroke-width": 15 }),
      path("M110 219 L90 245 Q79 258 96 261 L119 260 L135 229", "#765039"),
      path("M155 228 L166 258 L192 260 Q208 258 196 246 L178 218", "#765039"),
      path("M98 159 C91 173 89 204 107 224 C121 240 163 242 180 222 C201 197 182 170 179 157", "#765039"),
      ellipse(142, 197, 28, 31, variant === "black-and-white" ? palette.face : palette.hands),
      element("g", { class: "monkey-arm left" }, [
        path("M104 172 Q72 178 52 137 L37 112", "none", { "stroke-width": 22 }),
        path("M104 172 Q72 178 52 137 L37 112", "none", { stroke: "#765039", "stroke-width": 14 }),
        path("M38 122 Q24 123 23 112 L16 101 Q13 93 20 92 L30 104 L27 88 Q28 81 34 85 L41 103 L44 93 Q50 87 53 95 L53 112 Q51 122 38 122", "#efca91", { "stroke-width": 3 }),
      ]),
      element("g", { class: "monkey-arm right" }, [
        path("M177 172 Q210 178 221 143 L232 114", "none", { "stroke-width": 22 }),
        path("M177 172 Q210 178 221 143 L232 114", "none", { stroke: "#765039", "stroke-width": 14 }),
        path("M223 120 Q212 110 220 102 L233 86 Q239 82 241 89 L237 103 L249 94 Q257 93 253 101 L244 113 Q242 124 230 124", "#efca91", { "stroke-width": 3 }),
        element("g", { transform: "translate(197 55) rotate(-22 40 40) scale(.8)" }, [banana()]),
      ]),
      element("g", { class: "monkey-head" }, [
        ellipse(82, 111, 20, 25, "#765039", { stroke: "#482b21", "stroke-width": 4 }),
        ellipse(199, 111, 20, 25, "#765039", { stroke: "#482b21", "stroke-width": 4 }),
        ellipse(83, 111, 11, 15, "#efca91"),
        ellipse(198, 111, 11, 15, "#efca91"),
        path("M81 105 C75 58 102 32 139 33 C178 30 204 61 201 108 L194 142 Q182 168 140 170 Q94 168 84 143 Z", palette.crown),
        path("M90 96 C89 69 115 60 139 83 C161 57 193 69 191 99 L187 133 Q182 155 140 157 Q101 155 93 135 Z", "#f6dab0", { stroke: "none" }),
        path("M105 109 Q114 97 123 109 M155 109 Q164 97 173 109", "none", { "stroke-width": 5 }),
        ellipse(139, 122, 7, 5, "#482b21"),
        path("M120 133 Q139 163 158 133 Z", "#482b21", { "stroke-width": 3 }),
        path("M129 145 Q139 136 150 145 Q141 155 129 145", "#e5867d", { stroke: "none" }),
        ellipse(106, 126, 10, 5, "#e8ab81"),
        ellipse(174, 126, 10, 5, "#e8ab81"),
        path("M115 43 Q108 28 120 27 L135 38 Q132 17 143 22 L155 39", palette.crown),
      ]),
    ]);
    if (variant === "black-and-white") {
      body.insertBefore(path("M98 148 L89 166 L105 164 L108 180 L125 172 L140 185 L155 172 L173 180 L178 164 L192 166 L182 148 Z", palette.face, { "stroke-width": 3 }), body.lastElementChild);
    }
    svg.append(body);
    return svg;
  }

  globalThis.bananaFeedArt = Object.freeze({ banana, monkey, bananaPath, monkeyVariants, chooseMonkey });
})();
