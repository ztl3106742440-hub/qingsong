import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const cwd = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const args of [['--test', 'tests/core.test.mjs', 'tests/font-resources.test.mjs'], ['tools/build.mjs', '--check']]) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) process.exit(result.status || 1);
}
