import base from "../verification/jest.config.mjs";
export default {
  ...base,
  projects: [
    ...base.projects,
    {
      displayName: "web-unit",
      rootDir: base.rootDir,
      testMatch: ["<rootDir>/tests/web/**/*.test.tsx"],
      testEnvironment:
        "<rootDir>/apps/web/node_modules/jest-environment-jsdom/build/index.js",
      setupFilesAfterEnv: ["<rootDir>/tests/web/setup.ts"],
      extensionsToTreatAsEsm: [".ts", ".tsx"],
      transform: { "^.+\\.tsx?$": "<rootDir>/tooling/web/jest-transform.mjs" },
      moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
      moduleDirectories: ["node_modules", "<rootDir>/apps/web/node_modules"],
      modulePathIgnorePatterns: ["<rootDir>/\\.claude/"],
      testTimeout: 20000,
    },
  ],
};
