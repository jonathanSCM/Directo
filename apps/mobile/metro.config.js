const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Redirect native-only modules to web stubs when bundling for web
const nativeShims = {
  'react-native-maps': path.resolve(__dirname, 'src/shims/react-native-maps.ts'),
  'expo-secure-store': path.resolve(__dirname, 'src/shims/expo-secure-store.ts'),
};

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && nativeShims[moduleName]) {
    return { filePath: nativeShims[moduleName], type: 'sourceFile' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
