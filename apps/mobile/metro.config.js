const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const coreRoot = path.resolve(workspaceRoot, 'packages/core');
const rootModules = path.resolve(workspaceRoot, 'node_modules');
const mobileModules = path.resolve(projectRoot, 'node_modules');

function resolveMobileModule(name) {
  const nested = path.resolve(mobileModules, name);
  if (fs.existsSync(nested)) return nested;
  return path.resolve(rootModules, name);
}

const rootReact = new RegExp(
  `${rootModules.replace(/[/\\]/g, '[/\\\\]')}[/\\\\](react|react-dom|scheduler)[/\\\\]`,
);

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [mobileModules, rootModules];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  '@huntos/core': coreRoot,
  'jpeg-js': resolveMobileModule('jpeg-js'),
  react: resolveMobileModule('react'),
  'react-dom': resolveMobileModule('react-dom'),
  scheduler: resolveMobileModule('scheduler'),
};
config.resolver.unstable_enablePackageExports = false;
config.resolver.blockList = [rootReact];

module.exports = config;
