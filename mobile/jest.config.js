/**
 * mobile/jest.config.js
 * Jest configuration with moduleNameMapper for Expo virtual modules.
 */
module.exports = {
  globals: {
    __DEV__: true,
  },
  moduleNameMapper: {
    '^expo/virtual/env$': '<rootDir>/__mocks__/expoEnv.js',
    '^expo/virtual/env\\.js$': '<rootDir>/__mocks__/expoEnv.js',
    '\\.(tflite|png|jpg|jpeg|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*)',
  ],
};
