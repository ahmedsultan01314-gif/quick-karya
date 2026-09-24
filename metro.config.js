const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

config.serializer = config.serializer || {};
config.serializer.getPolyfills = ({ platform }) => {
  try {
    return require('react-native/rn-get-polyfills')();
  } catch {
    return [];
  }
};

module.exports = config;
