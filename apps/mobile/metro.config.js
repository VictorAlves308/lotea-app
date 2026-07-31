const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Expo Router treats every file under app/ as a route. Tests are colocated
// next to the code they test (see ARCHITECTURE.md §11), so Metro must be
// told to skip *.test.* files instead of bundling them as routes. Merge with
// whatever exclusions Expo's own default config already set, rather than
// replacing them.
const existingBlockList = config.resolver.blockList
  ? Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : [config.resolver.blockList]
  : [];
config.resolver.blockList = [...existingBlockList, /\.test\.[jt]sx?$/];

module.exports = withNativeWind(config, { input: './global.css' });
