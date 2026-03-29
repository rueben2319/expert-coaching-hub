#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const packageJsonPath = path.resolve('package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const dependencies = Object.keys(packageJson.dependencies ?? {});
const scriptCommands = Object.values(packageJson.scripts ?? {}).join('\n');

const rootsToScan = ['src', 'supabase'];
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.json']);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function gatherFiles(root) {
  if (!fs.existsSync(root)) return [];

  const files = [];
  const queue = [root];

  while (queue.length > 0) {
    const current = queue.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (extensions.has(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

const files = rootsToScan.flatMap(gatherFiles);
const rootFiles = fs
  .readdirSync('.', { withFileTypes: true })
  .filter((entry) => entry.isFile() && extensions.has(path.extname(entry.name)))
  .map((entry) => entry.name);

files.push(...rootFiles);
const fileContents = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const searchCorpus = `${fileContents}\n${scriptCommands}`;

const unusedDeps = dependencies.filter((dep) => {
  const depPattern = new RegExp(`(^|[^\\w@/-])${escapeRegex(dep)}(?:/[^\\s'"]*)?([^\\w@/-]|$)`, 'm');
  return !depPattern.test(searchCorpus);
});

if (unusedDeps.length > 0) {
  console.error('Unused direct dependencies detected:');
  for (const dep of unusedDeps) {
    console.error(`- ${dep}`);
  }
  process.exit(1);
}

console.log('No unused direct dependencies found in src/, supabase/, or package scripts.');
