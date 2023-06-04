import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
export const packageRootPath = path.join(__dirname, '..');

const packageJson = JSON.parse(readFileSync(path.join(packageRootPath, 'package.json'), 'utf-8'));

export const executableName = Object.keys(packageJson.bin)[0];
export const packageName = packageJson.name;
