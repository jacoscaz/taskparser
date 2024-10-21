
import { resolve } from 'node:path';
import { it } from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import { deepStrictEqual } from 'node:assert';

import { __dirname, taskninja } from './utils.js';
    
const tests_dir_path = resolve(__dirname, '..', '..', 'tests');

for (const item of await readdir(tests_dir_path)) {
  if (!item.match(/^\d{3}/)) {
    continue;
  }
  const this_test_path = resolve(tests_dir_path, item);
  const test_info = JSON.parse(await readFile(resolve(this_test_path, 'info.json'), 'utf8'));
  const expected_stdout = await readFile(resolve(this_test_path, 'stdout'), 'utf8');
  it(test_info.description, async () => {
    const stdout = await taskninja([...test_info.argv, this_test_path]);
    deepStrictEqual(stdout, expected_stdout);
  });
}
