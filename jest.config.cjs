/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  maxConcurrency: 1,
  setupFiles: [
    "fake-indexeddb/auto"
  ],
  testTimeout: 5000,
  detectOpenHandles: true,
  collectCoverage: false,
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts"
  ],
  coverageDirectory: "<rootDir>/target",
  transform: {}
};