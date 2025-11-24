import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";

export default [
  {
    ignores: ["node_modules/**", "dist/**", "test/**"]
  },
  js.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module"
      },
      globals: {
        console: "readonly",
        document: "readonly",
        window: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        navigator: "readonly",
        location: "readonly",
        history: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        EventListener: "readonly",
        EventTarget: "readonly",
        HTMLElement: "readonly",
        Element: "readonly",
        Map: "readonly",
        Set: "readonly",
        Promise: "readonly",
        WeakMap: "readonly",
        WeakSet: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "prettier": prettierPlugin
    },
    rules: {
      // Extend recommended rules
      ...tseslint.configs.recommended.rules,
      ...prettierConfig.rules,

      // Disable base ESLint rules that are superseded by TypeScript rules
      "no-unused-vars": "off",
      "no-use-before-define": "off",

      // TypeScript-specific rules
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-empty-object-type": "error",
      "@typescript-eslint/explicit-function-return-type": ["error", {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true
      }],

      // Prettier integration
      "prettier/prettier": "error",

      // Disable style rules that conflict with Prettier
      "indent": "off"
    }
  },
  {
    files: ["**/*.spec.ts", "**/*.test.ts"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        vi: "readonly",
        vitest: "readonly"
      }
    },
    rules: {
      "@typescript-eslint/explicit-function-return-type": "off"
    }
  }
];

