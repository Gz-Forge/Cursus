const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Excluir la carpeta de build de Rust para que Metro no intente vigilarla
config.watchFolders = (config.watchFolders ?? []).filter(
  f => !f.includes('src-tauri')
);

config.resolver = config.resolver ?? {};
config.resolver.blockList = [
  /src-tauri[\\/]target[\\/].*/,
  ...(config.resolver.blockList ? [config.resolver.blockList].flat() : []),
];

module.exports = config;
