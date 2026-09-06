import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "release/**",
      "test-results/**",
      "vscode-extension/**",
    ],
  },
  {
    files: ["*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        chrome: "readonly",
        bananaFeed: "readonly",
        bananaFeedArt: "readonly",
      },
    },
    rules: js.configs.recommended.rules,
  },
  {
    files: ["scripts/**/*.mjs", "tests/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: js.configs.recommended.rules,
  },
  {
    files: ["scripts/generate-store-assets.mjs", "tests/browser/**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        bananaFeed: "readonly",
        bananaFeedArt: "readonly",
      },
    },
  },
];
