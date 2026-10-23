module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/firestore.rules.test.js"],
  transform: {
    "\\.js$": [
      "babel-jest",
      {
        presets: ["@babel/preset-env"],
      },
    ],
  },
};
