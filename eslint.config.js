const globals = require("globals");

module.exports = [
  {
    ignores: ["node_modules/**", "dist/**"],
  },
  {
    files: ["background.js", "log.js", "src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        module: "readonly",
        AudioEncoder: "readonly",
        AudioData: "readonly",
        ImageDecoder: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
      "no-undef": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      eqeqeq: ["error", "smart"],
    },
  },
  {
    files: ["eslint.config.js", "tools/**/*.js", "tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
      "no-undef": "error",
      eqeqeq: ["error", "smart"],
    },
  },
];
