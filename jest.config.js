module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/*.test.js"],
  transform: {
    "\\.js$": [
      "babel-jest",
      {
        presets: ["@babel/preset-env", "@babel/preset-react"],
      },
    ],
  },
  moduleNameMapper: {
    "\\.css$": "<rootDir>/test/mocks/styleMock.js",
    "^firebase/app$": "<rootDir>/test/mocks/firebaseApp.js",
    "^firebase/auth$": "<rootDir>/test/mocks/firebaseAuth.js",
    "^firebase/firestore$": "<rootDir>/test/mocks/firebaseFirestore.js",
    "^@emailjs/browser$": "<rootDir>/test/mocks/emailjs.js",
  },
};
