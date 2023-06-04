import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootPath = path.join(__dirname, '..');

const packageJson = JSON.parse(readFileSync(path.join(rootPath, 'package.json'), 'utf-8'));

export const cliScript = path.join(rootPath, Object.values(packageJson.bin)[0]);
