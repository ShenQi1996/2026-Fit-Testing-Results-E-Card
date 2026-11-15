module.exports = {
  testEnvironment: "node",
  // Both rules suites share one emulator and clear it in beforeEach; run them serially.
  maxWorkers: 1,
  testMatch: [
    "<rootDir>/test/firestore.rules.test.js",
    "<rootDir>/test/backfillDeletedAt.emulator.test.js",
  ],
  transform: {
    "\\.js$": [
      "babel-jest",
      {
        presets: ["@babel/preset-env"],
      },
    ],
  },
};
