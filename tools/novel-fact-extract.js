#!/usr/bin/env node
// tools/novel-fact-extract.js
//
// Extract facts from a specific novel chunk and add them to the world fact log.
// In a real scenario, this would call an AI. Here we provide a CLI to manually
// or programmatically add evidence-backed facts.

import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  atomicWrite,
  commitManual,
  parseBlock,
  serializeBlock,
} from '../runtimes/ver001.handle.yume.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');

async function main() {
  const argv = process.argv.slice(2);
  const options = parseArgs(argv);

  if (options.help) {
    usage(0);
  }

  const factLogFile = resolve(options.factLog);
  const factLogContent = await readFile(factLogFile, 'utf8');
  const parsed = parseBlock(factLogContent);
  const head = parsed.head;

  // Extract the WorldFactLog object from the head string.
  const match = head.match(/export\s+const\s+WorldFactLog\s*=\s*(\{[\s\S]*\});/);
  if (!match) {
    throw new Error('Could not find WorldFactLog object in head');
  }

  const log = JSON.parse(match[1]);

  const newFact = {
    id: `fact-${String(log.facts.length + 1).padStart(6, '0')}`,
    term: options.term,
    claim: options.claim,
    source: [
      {
        chunkId: options.chunkId,
        lineStart: options.lineStart,
        lineEnd: options.lineEnd,
      }
    ],
    confidence: options.confidence ?? 'source',
    status: 'draft',
    ts: Date.now(),
  };

  log.facts.push(newFact);
  log.status = 'extracting';

  // Also remove from extractionQueue if present
  if (log.extractionQueue) {
    log.extractionQueue = log.extractionQueue.filter(q => q.term !== options.term);
  }

  // Update the head string by replacing the old object with the new one.
  const newHead = head.replace(
    /export\s+const\s+WorldFactLog\s*=\s*\{[\s\S]*\};/,
    `export const WorldFactLog = ${JSON.stringify(log, null, 2)};`
  );

  parsed.head = newHead;
  const updatedContent = serializeBlock(parsed);
  await atomicWrite(factLogFile, updatedContent);

  await commitManual(factLogFile, {
    note: {
      author: 'novel-fact-extract',
      kind: 'extraction',
      text: `add fact for "${options.term}" from ${options.chunkId}`,
    },
  });

  console.log(`Added fact ${newFact.id}: ${newFact.claim}`);
}

function parseArgs(argv) {
  const options = {
    factLog: null,
    term: null,
    claim: null,
    chunkId: null,
    lineStart: null,
    lineEnd: null,
    confidence: 'source',
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const readValue = () => argv[++i];

    switch (arg) {
      case '--fact-log': options.factLog = readValue(); break;
      case '--term': options.term = readValue(); break;
      case '--claim': options.claim = readValue(); break;
      case '--chunk': options.chunkId = readValue(); break;
      case '--line-start': options.lineStart = parseInt(readValue(), 10); break;
      case '--line-end': options.lineEnd = parseInt(readValue(), 10); break;
      case '--confidence': options.confidence = readValue(); break;
      case '--help': options.help = true; break;
      default: console.error(`Unknown option: ${arg}`); process.exit(1);
    }
  }

  if (!options.help && (!options.factLog || !options.term || !options.claim || !options.chunkId)) {
    console.error('Missing required options.');
    usage(1);
  }

  return options;
}

function usage(exitCode) {
  console.log(`Usage:
  node tools/novel-fact-extract.js --fact-log <file> --term <term> --claim <claim> --chunk <chunkId> --line-start <n> --line-end <n>

Options:
  --fact-log <file>    Path to the world.facts.yume.js file
  --term <term>        The term this fact is about
  --claim <claim>      The fact description
  --chunk <chunkId>    Source chunk ID
  --line-start <n>     Starting line in the source (optional)
  --line-end <n>       Ending line in the source (optional)
  --confidence <kind>  Confidence level (source|inferred|uncertain)
`);
  process.exit(exitCode);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
