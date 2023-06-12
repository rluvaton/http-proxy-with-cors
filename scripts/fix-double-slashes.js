// Doing this ugly thing until https://github.com/fastify/fastify-reply-from/pull/319 is deployed

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import isPathInside from 'is-path-inside';
import globalDirs from 'global-dirs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const packageRootPath = path.join(__dirname, '../');

function patch() {
  if (isYarnGlobalInstall()) {
    console.log('installed globally with yarn');
    regularPatch();
    return;
  }

  if (isNpmGlobalInstall()) {
    console.log('installed globally with npm');
    regularPatch();
    return;
  }

  // NPM local install
  if (isLocalInstall()) {
    console.log('installed locally with npm');
    regularPatch();
    return;
  }

  console.log('installed with npx');
  patchForNpx();
}

function isYarnGlobalInstall() {
  return isPathInside(__dirname, globalDirs.yarn.packages);
}

function isNpmGlobalInstall() {
  return isPathInside(__dirname, fs.realpathSync(globalDirs.npm.packages));
}

function isLocalInstall() {
  // We shouldn't have the vitest.config.js in other cases as it's not inside the package json files array
  return fs.existsSync(path.join(packageRootPath, 'vitest.config.js'));
}

function regularPatch() {
  console.log('running regular patch-package');
  execSync(`patch-package`, {
    stdio: 'inherit',
  });
}

function patchForNpx() {
  console.log('running patch-package for npx');

  const npxPackageRootPath = path.join(packageRootPath, '../../');

  // Can happen as this is running in post install before the created package-json
  // patch-package requires a package.json to be present
  const patchPackageNeededJsonFile = path.join(npxPackageRootPath, 'package.json');
  if (!fs.existsSync(patchPackageNeededJsonFile)) {
    fs.writeFileSync(
      patchPackageNeededJsonFile,
      JSON.stringify({
        dependencies: {},
      }),
    );
  }

  execSync(`patch-package --patch-dir ./node_modules/http-proxy-with-cors/patches`, {
    stdio: 'inherit',
    cwd: npxPackageRootPath,
  });

  fs.rmSync(patchPackageNeededJsonFile);
}

patch();
