#!/usr/bin/env node
// tools/novel-settings-normalize.js
//
// Normalize facts and relations into a settings collection entry.

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

  const collectionFile = resolve(options.collection);
  const catalogFile = resolve(options.catalog);

  const collectionContent = await readFile(collectionFile, 'utf8');
  const catalogContent = await readFile(catalogFile, 'utf8');

  const parsedCollection = parseBlock(collectionContent);
  const parsedCatalog = parseBlock(catalogContent);

  const collection = JSON.parse(parsedCollection.head.match(/export\s+const\s+SettingsCollection\s*=\s*(\{[\s\S]*\});/)[1]);
  const catalog = JSON.parse(parsedCatalog.head.match(/export\s+const\s+SettingsCatalog\s*=\s*(\{[\s\S]*\});/)[1]);

  const entryId = `${collection.collection.type}-setting-${String(collection.entries.length + 1).padStart(6, '0')}`;
  
  const newEntry = {
    id: entryId,
    title: options.title,
    terms: options.terms ? options.terms.split(',') : [options.title],
    aliases: options.aliases ? options.aliases.split(',') : [],
    summary: options.summary,
    facts: options.facts ? options.facts.split(',') : [],
    relations: options.relations ? options.relations.split(',') : [],
    evidenceRefs: options.evidence ? options.evidence.split(',').map(e => {
      const [source, id] = e.split(':');
      return { source, id };
    }) : [],
    confidence: options.confidence ?? 'source',
    status: 'draft',
  };

  collection.entries.push(newEntry);
  collection.status = 'normalizing';

  // Update Catalog termLookup
  for (const termName of newEntry.terms) {
    const lookup = catalog.termLookup.find(t => t.term === termName);
    if (lookup) {
      if (!lookup.entries) lookup.entries = [];
      lookup.entries.push({ collection: collection.collection.id, id: entryId });
    }
  }

  // Write Collection
  parsedCollection.head = parsedCollection.head.replace(
    /export\s+const\s+SettingsCollection\s*=\s*\{[\s\S]*\};/,
    `export const SettingsCollection = ${JSON.stringify(collection, null, 2)};`
  );
  await atomicWrite(collectionFile, serializeBlock(parsedCollection));
  await commitManual(collectionFile, {
    note: { author: 'novel-settings-normalize', kind: 'normalization', text: `add entry "${options.title}"` },
  });

  // Write Catalog
  parsedCatalog.head = parsedCatalog.head.replace(
    /export\s+const\s+SettingsCatalog\s*=\s*\{[\s\S]*\};/,
    `export const SettingsCatalog = ${JSON.stringify(catalog, null, 2)};`
  );
  await atomicWrite(catalogFile, serializeBlock(parsedCatalog));
  await commitManual(catalogFile, {
    note: { author: 'novel-settings-normalize', kind: 'normalization', text: `link entry "${options.title}" in catalog` },
  });

  console.log(`Normalized entry ${entryId}: ${options.title}`);
}

function parseArgs(argv) {
  const options = {
    collection: null,
    catalog: null,
    title: null,
    terms: null,
    aliases: null,
    summary: null,
    facts: null,
    relations: null,
    evidence: null,
    confidence: 'source',
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const readValue = () => argv[++i];

    switch (arg) {
      case '--collection': options.collection = readValue(); break;
      case '--catalog': options.catalog = readValue(); break;
      case '--title': options.title = readValue(); break;
      case '--terms': options.terms = readValue(); break;
      case '--aliases': options.aliases = readValue(); break;
      case '--summary': options.summary = readValue(); break;
      case '--facts': options.facts = readValue(); break;
      case '--relations': options.relations = readValue(); break;
      case '--evidence': options.evidence = readValue(); break;
      case '--confidence': options.confidence = readValue(); break;
      case '--help': options.help = true; break;
      default: console.error(`Unknown option: ${arg}`); process.exit(1);
    }
  }

  if (!options.help && (!options.collection || !options.catalog || !options.title || !options.summary)) {
    console.error('Missing required options.');
    usage(1);
  }

  return options;
}

function usage(exitCode) {
  console.log(`Usage:
  node tools/novel-settings-normalize.js --collection <file> --catalog <file> --title <title> --summary <summary> [options]

Options:
  --collection <file>  Path to the settings.collection.yume.js file
  --catalog <file>     Path to the settings.catalog.yume.js file
  --title <title>      Entry title
  --terms <list>       Comma-separated list of terms (default: title)
  --aliases <list>     Comma-separated list of aliases
  --summary <text>     Entry summary
  --facts <list>       Comma-separated list of fact IDs
  --relations <list>   Comma-separated list of relation IDs
  --evidence <list>    Comma-separated list of source:id (e.g. facts:fact-000001,relations:rel-000001)
`);
  process.exit(exitCode);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
