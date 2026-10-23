const js = require("@eslint/js");
const globals = require("globals");
const react = require("eslint-plugin-react");
const reactHooks = require("eslint-plugin-react-hooks");
const unusedImports = require("eslint-plugin-unused-imports");

// Style and preference rules warn so existing code can land.
// Errors are reserved for real problems such as undefined variables, parse errors,
// and unused imports.
const styleWarnings = {
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
  // Source files use 2-space indentation. Warn until older lines are aligned.
  indent: ["warn", 2],
  // Constants in this repo use SCREAMING_SNAKE_CASE, so naming stays a warning.
  // Object keys are ignored because EmailJS and similar payloads require them.
  camelcase: ["warn", { properties: "never" }],
  "unused-imports/no-unused-vars": [
    "warn",
    {
      vars: "all",
      varsIgnorePattern: "^_",
      args: "after-used",
      argsIgnorePattern: "^_",
      caughtErrors: "all",
      caughtErrorsIgnorePattern: "^_",
    },
  ],
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
      "unused-imports": unusedImports,
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
      "no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      ...styleWarnings,
    },
  },
  {
    files: ["src/**/*.test.js"],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },
    },
  },
];
