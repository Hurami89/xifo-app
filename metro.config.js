// The PC app (desktop/) has its own packages: keep Metro out of them.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
const desktop = path.resolve(__dirname, 'desktop').replace(/[\\/]/g, '[\\\\/]');
config.resolver.blockList = [new RegExp(`^${desktop}[\\\\/].*`)];
module.exports = config;
