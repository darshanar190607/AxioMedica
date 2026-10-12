/**
 * mobile/jest.config.js
 * Jest configuration with moduleNameMapper for Expo virtual modules.
 */
module.exports = {
  moduleNameMapper: {
    '^expo/virtual/env$': '<rootDir>/__mocks__/expoEnv.js',
    '^expo/virtual/env\\.js$': '<rootDir>/__mocks__/expoEnv.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*)',
  ],
};
