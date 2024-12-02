
import { resolve, dirname } from 'node:path';
import { it, describe } from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import { deepStrictEqual } from 'node:assert';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
    
const __dirname = dirname(fileURLToPath(import.meta.url));

const bin_path = resolve(__dirname, 'bin.js');

const tests_dir_path = resolve(__dirname, '..', 'tests');

const taskparser = async (argv: string[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    const child = spawn(`node ${bin_path}`, argv, { shell: true });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('exit', (code) => {
      if (code === null || code === 0) {
        resolve(stdout);
        return;
      }
      console.log(stdout);
      console.log(stderr);
      reject(new Error(`child process exited with non-zero code`));
    });
  });
};

const tests: { description: string; argv: string[], stdout: string, path: string }[] = [];

for (const item of await readdir(tests_dir_path)) {
  if (!item.match(/^\d{3}/)) {
    continue;
  }
  const this_test_path = resolve(tests_dir_path, item);
  const test_info = JSON.parse(await readFile(resolve(this_test_path, 'test-info.json'), 'utf8'));
  const stdout = await readFile(resolve(this_test_path, 'test-stdout'), 'utf8');
  tests.push({ ...test_info, stdout, path: this_test_path });  
}

describe('taskparser', () => {
  tests.forEach((test) => {
    it(test.description, async () => {
      const stdout = await taskparser([...test.argv, test.path]);
      deepStrictEqual(stdout, test.stdout);
    });
  })
});
