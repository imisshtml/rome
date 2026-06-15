const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

config.resolver.unstable_conditionNames = [
  'react-native',
  'require',
  'default',
];

module.exports = config;
