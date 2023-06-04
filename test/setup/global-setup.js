import { setupVerdaccio, teardownVerdaccio } from './verdaccio-helpers.js';
import { execa } from 'execa';
import { packageName, packageRootPath } from '../const.js';

export async function setup() {
  console.log('Setting up Verdaccio (private NPM registry');
  const { npmEnvironmentVars } = await setupVerdaccio();

  console.log('Publishing npm package locally');
  await execa('npm', ['publish', '--tag=e2e'], {
    env: {
      ...npmEnvironmentVars,
      npm_config_provenance: 'false',
    },
    cwd: packageRootPath,
  });

  console.log('Installing the npm package globally');
  await execa('npm', ['i', `--registry=${npmEnvironmentVars.npm_config_registry}`, '--global', `${packageName}@e2e`]);

  console.log('The package installed successfully, ready for testing\n\n');
}

export async function teardown() {
  await teardownVerdaccio();
}
