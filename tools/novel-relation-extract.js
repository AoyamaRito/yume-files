#!/usr/bin/env node
// tools/novel-relation-extract.js
//
// Extract relations from a specific novel chunk and add them to the relation index.

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  atomicWrite,
  commitManual,
  parseBlock,
  serializeBlock,
} from '../runtimes/ver001.handle.yume.js';

async function main() {
  const argv = process.argv.slice(2);
  const options = parseArgs(argv);

  if (options.help) {
    usage(0);
  }

  const relIndexFile = resolve(options.relationIndex);
  const relIndexContent = await readFile(relIndexFile, 'utf8');
  const parsed = parseBlock(relIndexContent);
  const head = parsed.head;

  // Extract the RelationIndex object from the head string.
  const match = head.match(/export\s+const\s+RelationIndex\s*=\s*(\{[\s\S]*\});/);
  if (!match) {
    throw new Error('Could not find RelationIndex object in head');
  }

  const log = JSON.parse(match[1]);

  const newRelation = {
    id: `rel-${String(log.relations.length + 1).padStart(6, '0')}`,
    from: options.from,
    to: options.to,
    kind: options.kind,
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

  log.relations.push(newRelation);
  log.status = 'extracting';

  // Update the head string by replacing the old object with the new one.
  const newHead = head.replace(
    /export\s+const\s+RelationIndex\s*=\s*\{[\s\S]*\};/,
    `export const RelationIndex = ${JSON.stringify(log, null, 2)};`
  );

  parsed.head = newHead;
  const updatedContent = serializeBlock(parsed);
  await atomicWrite(relIndexFile, updatedContent);

  await commitManual(relIndexFile, {
    note: {
      author: 'novel-relation-extract',
      kind: 'extraction',
      text: `add relation "${options.from}" -> "${options.to}" (${options.kind})`,
    },
  });

  console.log(`Added relation ${newRelation.id}: ${options.from} ${options.kind} ${options.to}`);
}

function parseArgs(argv) {
  const options = {
    relationIndex: null,
    from: null,
    to: null,
    kind: null,
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
      case '--relation-index': options.relationIndex = readValue(); break;
      case '--from': options.from = readValue(); break;
      case '--to': options.to = readValue(); break;
      case '--kind': options.kind = readValue(); break;
      case '--claim': options.claim = readValue(); break;
      case '--chunk': options.chunkId = readValue(); break;
      case '--line-start': options.lineStart = parseInt(readValue(), 10); break;
      case '--line-end': options.lineEnd = parseInt(readValue(), 10); break;
      case '--confidence': options.confidence = readValue(); break;
      case '--help': options.help = true; break;
      default: console.error(`Unknown option: ${arg}`); process.exit(1);
    }
  }

  if (!options.help && (!options.relationIndex || !options.from || !options.to || !options.kind || !options.chunkId)) {
    console.error('Missing required options.');
    usage(1);
  }

  return options;
}

function usage(exitCode) {
  console.log(`Usage:
  node tools/novel-relation-extract.js --relation-index <file> --from <term> --to <term> --kind <kind> --claim <claim> --chunk <chunkId>

Options:
  --relation-index <file>  Path to the relations.index.yume.js file
  --from <term>            Starting term
  --to <term>              Target term
  --kind <kind>            Relation kind (appears-with|belongs-to|located-in|uses|opposes|aliases|unknown)
  --claim <claim>          Brief claim about the relation
  --chunk <chunkId>        Source chunk ID
  --line-start <n>         Starting line in the source (optional)
  --line-end <n>           Ending line in the source (optional)
  --confidence <kind>      Confidence level (source|inferred|uncertain)
`);
  process.exit(exitCode);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
