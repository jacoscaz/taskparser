
import { resolve, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
    
export const __dirname = dirname(fileURLToPath(import.meta.url));

export const bin_path = resolve(__dirname, '..', 'bin.js');

export const taskninja = async (argv: string[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    const child = spawn(bin_path, argv);
    let stdout = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.on('exit', (code) => {
      if (code === null || code === 0) {
        resolve(stdout);
        return;
      }
      console.log(stdout);
      reject(new Error(`child process exited with non-zero code`));
    });
  });
};
