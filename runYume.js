import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { stat } from 'node:fs/promises';

async function fileExists(path) {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

async function findRuntime(startDir, version) {
  let currentDir = startDir;
  
  while (true) {
    const defaultYume = join(currentDir, 'yume', `ver${version}.handle.yume.js`);
    if (await fileExists(defaultYume)) return defaultYume;

    const runtimesDir = join(currentDir, 'runtimes', `ver${version}.handle.yume.js`);
    if (await fileExists(runtimesDir)) return runtimesDir;

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
  // fallback to runYume.js directory
  const runYumeDir = dirname(new URL(import.meta.url).pathname);
  const fallbackRuntimes = join(runYumeDir, 'runtimes', `ver${version}.handle.yume.js`);
  if (await fileExists(fallbackRuntimes)) return fallbackRuntimes;
  return null;
}

async function main() {
  const [, , targetPath, verb, ...args] = process.argv;

  if (!targetPath) {
    console.error('Usage: node runYume.js <target.yume.js> <verb> [args...]');
    process.exit(1);
  }

  const resolvedTarget = resolve(targetPath);
  let source;
  try {
    source = await readFile(resolvedTarget, 'utf8');
  } catch (e) {
    console.error(`Error reading file ${targetPath}:`, e.message);
    process.exit(1);
  }

  const blockMatch = source.match(/export\s+const\s+__block\s*=\s*(\{[\s\S]+?\});/);
  if (!blockMatch) {
    console.error(`Error: __block not found in ${targetPath}`);
    process.exit(1);
  }

  let block;
  try {
    block = JSON.parse(blockMatch[1]);
  } catch (e) {
    console.error(`Error parsing __block in ${targetPath}:`, e.message);
    process.exit(1);
  }

  if (!block.runtime || !block.runtime.version) {
    console.error(`Error: __block.runtime.version missing in ${targetPath}`);
    process.exit(1);
  }

  const version = block.runtime.version;
  let runtimePath = null;

  if (block.runtime.path) {
    runtimePath = resolve(dirname(resolvedTarget), block.runtime.path);
  } else {
    runtimePath = await findRuntime(dirname(resolvedTarget), version);
  }

  if (!runtimePath || !(await fileExists(runtimePath))) {
    console.error(`Error: Runtime version ${version} not found.`);
    process.exit(1);
  }

  let rt;
  try {
    rt = await import(pathToFileURL(runtimePath).href);
  } catch (e) {
    console.error(`Error loading runtime from ${runtimePath}:`, e.message);
    process.exit(1);
  }

  const simulatedArgv = [
    process.argv[0], // node
    resolvedTarget,  // target file
    verb,
    ...args
  ];

  try {
    await rt.cli(pathToFileURL(resolvedTarget).href, block, simulatedArgv);
  } catch (e) {
    console.error(`Error executing ${verb}:`, e);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
