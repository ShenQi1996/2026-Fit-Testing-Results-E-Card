const js = require("@eslint/js");
const globals = require("globals");
const react = require("eslint-plugin-react");
const reactHooks = require("eslint-plugin-react-hooks");

// Style and preference rules warn so existing code can land.
// Errors are reserved for real problems such as undefined variables and parse errors.
const styleWarnings = {
  "no-unused-vars": "warn",
  "no-unused-labels": "warn",
  "no-empty": "warn",
  "no-extra-boolean-cast": "warn",
  "no-useless-escape": "warn",
  "no-prototype-builtins": "warn",
  "no-useless-catch": "warn",
  "react/prop-types": "warn",
  "react/display-name": "warn",
  "react/no-unescaped-entities": "warn",
  "react-hooks/exhaustive-deps": "warn",
};

module.exports = [
  {
    ignores: ["node_modules/**", "dist/**"],
  },
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      ...styleWarnings,
    },
  },
];
