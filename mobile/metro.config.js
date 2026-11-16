const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable wasm asset resolution for expo-sqlite web worker and tflite models
config.resolver.assetExts.push('wasm', 'tflite');

module.exports = config;
