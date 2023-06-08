import path from 'node:path';
import fsExtra from 'fs-extra';
import { execa } from 'execa';
import { setupVerdaccio, teardownVerdaccio } from './verdaccio-helpers.js';
import { packageName, packageRootPath } from '../const.js';

export async function setup() {
  await cleanAlreadyInstalledPackageIfExists();

  console.log('Setting up Verdaccio (private NPM registry');
  const { npmEnvironmentVars } = await setupVerdaccio();

  console.log('Publishing npm package locally');
  await execa('npm', ['publish', '--tag=e2e'], {
    env: npmEnvironmentVars,
    cwd: packageRootPath,
  });

  console.log('Installing the npm package globally');
  try {
    await installPackageGlobally(npmEnvironmentVars);
  } catch (e) {
    console.log('failed to install the package globally, try cleaning up');

    const { stdout: prefixLocation } = await execa('npm', ['config', 'get', 'prefix']);

    console.log('Removing the package from the global npm cache');
    await fsExtra.remove(path.join(prefixLocation, 'lib/node_modules', packageName));
    console.log('npm cache removed');

    console.log('trying to install again');
    await installPackageGlobally(npmEnvironmentVars);
  }

  console.log('The package installed successfully, ready for testing\n\n');
}

export async function teardown() {
  await cleanAlreadyInstalledPackageIfExists();
  await teardownVerdaccio();
}

async function cleanAlreadyInstalledPackageIfExists() {
  console.log('Uninstalling the npm package globally');
  await execa('npm', ['uninstall', '--global', `${packageName}@e2e`]);
  console.log('package uninstalled successfully');
}

async function installPackageGlobally(npmEnvironmentVars) {
  await execa('npm', [
    'i',
    `--registry=${npmEnvironmentVars.npm_config_registry}`,
    '--global',
    `${packageName}@e2e`,

    // Easier to debug
    '--foreground-scripts',
  ]);
}
