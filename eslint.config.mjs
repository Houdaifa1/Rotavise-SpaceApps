import tseslint from "typescript-eslint";
import { builtinModules } from "node:module";
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/migrations/**",
      ".artifacts/**",
      ".research-sources/**",
      ".claude/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["packages/domain/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "node:*",
                ...builtinModules,
                "@nestjs/*",
                "fastify",
                "pg",
                "pg-boss",
                "@rotavise/database",
                "react",
                "react-dom",
                "**/apps/**",
              ],
              message:
                "The calculation engine must remain pure and independent of infrastructure.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        "process",
        "fetch",
        "Date",
        "performance",
        "crypto",
        "setTimeout",
        "setInterval",
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.name='Math'][property.name='random']",
          message: "The engine must be deterministic.",
        },
        {
          selector: "MemberExpression[object.name='globalThis']",
          message: "The engine cannot read ambient runtime state.",
        },
        {
          selector: "ImportExpression",
          message: "Dynamic imports cannot bypass domain boundaries.",
        },
      ],
    },
  },
  {
    files: ["packages/catalog/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@nestjs/*",
                "fastify",
                "pg",
                "pg-boss",
                "@rotavise/database",
                "react",
                "react-dom",
                "node:*",
                ...builtinModules,
                "**/apps/**",
              ],
              message:
                "The catalog domain must stay independent of persistence, files, HTTP and UI.",
            },
          ],
        },
      ],
      "no-restricted-globals": ["error", "Buffer", "process", "fetch"],
    },
  },
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@rotavise/database", "pg", "pg-boss", "**/server/**"],
              message:
                "The frontend communicates through contracts and HTTP; server infrastructure stays on the server.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/contracts/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@rotavise/database",
                "@nestjs/*",
                "pg",
                "pg-boss",
                "**/apps/**",
                "node:*",
                ...builtinModules,
              ],
              message:
                "Contracts must remain independent of runtime applications and persistence.",
            },
          ],
        },
      ],
      "no-restricted-globals": ["error", "Buffer", "process", "fetch"],
    },
  },
  {
    files: ["packages/database/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@nestjs/*", "react", "react-dom", "**/apps/**"],
              message:
                "Database infrastructure cannot depend on application or UI modules.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/server/src/modules/*/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@nestjs/*", "fastify"],
              message:
                "Feature application logic stays independent of HTTP and Nest composition.",
            },
          ],
        },
      ],
    },
  },
  {
    // Type-aware promise checks: an unawaited database, queue or mail call can
    // lose errors or ordering silently.
    files: ["apps/server/src/**/*.ts", "packages/*/src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        URL: "readonly",
        fetch: "readonly",
      },
    },
  },
);
