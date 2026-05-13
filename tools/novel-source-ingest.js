#!/usr/bin/env node
// Fast local ingest for long novel txt sources.
//
// This command deliberately stops before "clean world modeling". It creates
// chunk, term, occurrence, and manifest intermediates so an AI can later work
// on small focused windows instead of rereading and normalizing the whole txt.

import { existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  atomicWrite,
  commitManual,
  extractRefsAndTags,
  hashContent,
  parseBlock,
  serializeBlock,
} from '../runtimes/ver001.handle.yume.js';

const TOOL_VERSION = 'novel-source-ingest-v1';
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const RUNTIME_PATH = join(REPO_ROOT, 'runtimes', 'ver001.handle.yume.js');

const DEFAULTS = {
  chunkLines: 80,
  chunkChars: 9000,
  previewChars: 220,
  maxYumeTerms: 1000,
  minCount: 1,
};

const STOP_TERMS = new Set([
  'ある', 'いる', 'する', 'した', 'して', 'なる', 'ない', 'こと', 'もの', 'ため', 'よう',
  'それ', 'これ', 'ここ', 'そこ', 'あれ', 'どこ', 'そして', 'しかし', 'また', 'ただ',
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'onto',
]);

const PLACE_SUFFIXES = [
  '王国', '帝国', '共和国', '都市', '市', '町', '村', '国', '領', '州', '区', '街',
  '塔', '城', '宮', '神殿', '寺院', '港', '島', '森', '山', '谷', '川', '海', '湖',
  '通り', '広場', '学院', '砦',
];

const GROUP_SUFFIXES = [
  '教団', '騎士団', '軍', '隊', '組織', '評議会', '家', '族', '商会', '同盟', '連盟',
  '公社', '省', '庁', '班', '派',
];

const EVENT_SUFFIXES = ['戦争', '事件', '儀式', '祭', '会議', '作戦', '計画'];

const segmenter = typeof Intl?.Segmenter === 'function'
  ? new Intl.Segmenter(['ja', 'en'], { granularity: 'word' })
  : null;

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const sourcePath = resolve(options.input);
  const sourceBuffer = await readFile(sourcePath);
  const sourceText = sourceBuffer.toString('utf8');
  const normalizedText = normalizeLineEndings(sourceText);
  const sourceHash = sha256(sourceBuffer);
  const outputDir = resolve(options.outDir ?? dirname(sourcePath));
  const stem = safeStem(options.stem ?? stripKnownExt(basename(sourcePath)));
  const sourceId = options.sourceId ?? `${stem}-txt`;
  const runHash = sha256Text(JSON.stringify({
    tool: TOOL_VERSION,
    sourceHash,
    chunkLines: options.chunkLines,
    chunkChars: options.chunkChars,
  })).slice(0, 12);
  const workDir = resolve(options.workDir ?? join(outputDir, '.yume-work', `${stem}-${runHash}`));
  const chunksDir = join(workDir, 'chunks');

  await mkdir(outputDir, { recursive: true });
  await mkdir(chunksDir, { recursive: true });

  const chunks = makeChunks(normalizedText, {
    chunkLines: options.chunkLines,
    chunkChars: options.chunkChars,
    previewChars: options.previewChars,
  });
  const occurrences = extractOccurrences(chunks);
  const terms = buildTermIndex(occurrences);
  const yumeTerms = terms
    .filter((term) => term.count >= options.minCount)
    .slice(0, options.maxYumeTerms);

  for (const chunk of chunks) {
    await atomicWrite(join(chunksDir, `${chunk.id}.txt`), chunk.text);
  }

  const sourceIndexJson = buildSourceIndex({
    sourceId,
    sourcePath,
    outputDir,
    sourceBuffer,
    normalizedText,
    sourceHash,
    chunks,
    workDir,
    options,
  });
  const termIndexJson = buildTermIndexJson({
    sourceId,
    sourceHash,
    sourceIndexFile: `${stem}.source.index.yume.js`,
    terms,
    yumeTerms,
    occurrences,
    workDir,
    outputDir,
    options,
  });
  const manifest = buildManifest({
    sourceId,
    sourcePath,
    outputDir,
    sourceHash,
    sourceBuffer,
    normalizedText,
    chunks,
    terms,
    yumeTerms,
    occurrences,
    workDir,
    options,
    outputs: {
      sourceIndex: `${stem}.source.index.yume.js`,
      termIndex: `${stem}.terms.index.yume.js`,
      relationIndex: `${stem}.relations.index.yume.js`,
      factLog: `${stem}.world.facts.yume.js`,
    },
  });

  await writeJson(join(workDir, 'manifest.json'), manifest);
  await writeJson(join(workDir, 'source.index.json'), sourceIndexJson);
  await writeJson(join(workDir, 'terms.index.json'), termIndexJson);
  await writeJsonl(join(workDir, 'occurrences.jsonl'), occurrences);
  await writeJsonl(join(workDir, 'terms.raw.jsonl'), terms);
  await atomicWrite(join(workDir, 'relations.raw.jsonl'), '');
  await atomicWrite(join(workDir, 'facts.raw.jsonl'), '');

  const sourceIndexFile = join(outputDir, `${stem}.source.index.yume.js`);
  const termIndexFile = join(outputDir, `${stem}.terms.index.yume.js`);
  const relationIndexFile = join(outputDir, `${stem}.relations.index.yume.js`);
  const factLogFile = join(outputDir, `${stem}.world.facts.yume.js`);
  const workdirStatus = options.cleanWorkdir ? 'cleaned-after-success' : 'available';

  const writes = [];
  writes.push(await writeYumeFile(sourceIndexFile, {
    blockId: blockIdFromStem(stem, 'SourceIndex'),
    type: 'source.index',
    head: sourceIndexHead({ ...sourceIndexJson, workdir: { ...sourceIndexJson.workdir, status: workdirStatus } }),
  }));
  writes.push(await writeYumeFile(termIndexFile, {
    blockId: blockIdFromStem(stem, 'TermsIndex'),
    type: 'terms.index',
    head: termIndexHead({
      ...termIndexJson,
      workdir: { ...termIndexJson.workdir, status: workdirStatus },
      terms: yumeTerms,
    }),
  }));
  writes.push(await writeYumeFile(relationIndexFile, {
    blockId: blockIdFromStem(stem, 'RelationsIndex'),
    type: 'relations.index',
    head: relationIndexHead({
      sourceId,
      sourceHash,
      sourceIndexFile: `./${basename(sourceIndexFile)}`,
      termIndexFile: `./${basename(termIndexFile)}`,
      workdir: {
        path: relativePath(outputDir, workDir),
        status: workdirStatus,
      },
      terms: yumeTerms,
    }),
  }));
  writes.push(await writeYumeFile(factLogFile, {
    blockId: blockIdFromStem(stem, 'WorldFacts'),
    type: 'world.facts',
    head: factLogHead({
      sourceId,
      sourceHash,
      sourceIndexFile: `./${basename(sourceIndexFile)}`,
      termIndexFile: `./${basename(termIndexFile)}`,
      relationIndexFile: `./${basename(relationIndexFile)}`,
      workdir: {
        path: relativePath(outputDir, workDir),
        status: workdirStatus,
      },
      extractionQueue: yumeTerms.slice(0, 100).map((term) => ({
        term: term.term,
        count: term.count,
        spread: term.spread,
        kindHints: term.kindHints,
      })),
    }),
  }));

  if (options.cleanWorkdir) {
    await rm(workDir, { recursive: true, force: true });
  }

  printSummary({ chunks, terms, yumeTerms, occurrences, workDir, writes, cleanWorkdir: options.cleanWorkdir });
}

function parseArgs(argv) {
  const positionals = [];
  const options = { ...DEFAULTS, cleanWorkdir: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') usage(0);
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const readValue = () => {
      const value = argv[++i];
      if (!value || value.startsWith('--')) usage(1, `${arg} requires a value`);
      return value;
    };
    switch (arg) {
      case '--out-dir': options.outDir = readValue(); break;
      case '--work-dir': options.workDir = readValue(); break;
      case '--stem': options.stem = readValue(); break;
      case '--source-id': options.sourceId = readValue(); break;
      case '--chunk-lines': options.chunkLines = positiveInt(readValue(), arg); break;
      case '--chunk-chars': options.chunkChars = positiveInt(readValue(), arg); break;
      case '--preview-chars': options.previewChars = positiveInt(readValue(), arg); break;
      case '--max-yume-terms': options.maxYumeTerms = positiveInt(readValue(), arg); break;
      case '--min-count': options.minCount = positiveInt(readValue(), arg); break;
      case '--clean-workdir': options.cleanWorkdir = true; break;
      case '--keep-workdir': options.cleanWorkdir = false; break;
      default: usage(1, `unknown option: ${arg}`);
    }
  }

  if (positionals.length !== 1) usage(1, 'expected exactly one input txt path');
  options.input = positionals[0];
  return options;
}

function usage(exitCode, message) {
  if (message) console.error(`error: ${message}\n`);
  console.error(`Usage:
  node tools/novel-source-ingest.js <input.txt> [options]

Options:
  --out-dir <dir>          Output directory for generated .yume.js files
  --work-dir <dir>         Intermediate work directory
  --stem <name>            Output file stem (default: input basename)
  --source-id <id>         Stable source id stored in generated files
  --chunk-lines <n>        Max lines per chunk (default: ${DEFAULTS.chunkLines})
  --chunk-chars <n>        Max chars per chunk (default: ${DEFAULTS.chunkChars})
  --preview-chars <n>      Preview chars per chunk in yume output (default: ${DEFAULTS.previewChars})
  --max-yume-terms <n>     Max terms embedded in terms.index.yume.js (default: ${DEFAULTS.maxYumeTerms})
  --min-count <n>          Minimum occurrence count for yume terms (default: ${DEFAULTS.minCount})
  --clean-workdir          Delete intermediates after successful yume output
  --keep-workdir           Keep intermediates (default)
`);
  process.exit(exitCode);
}

function positiveInt(value, flag) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) usage(1, `${flag} must be a positive integer`);
  return n;
}

function makeChunks(source, options) {
  if (source.length === 0) return [];
  const lines = source.split('\n');
  const lineStarts = [];
  let cursor = 0;
  for (const line of lines) {
    lineStarts.push(cursor);
    cursor += line.length + 1;
  }

  const chunks = [];
  let startLineIndex = 0;
  while (startLineIndex < lines.length) {
    let endLineIndex = startLineIndex;
    let chars = 0;
    while (endLineIndex < lines.length) {
      const nextLen = lines[endLineIndex].length + (endLineIndex > startLineIndex ? 1 : 0);
      if (endLineIndex > startLineIndex &&
          (endLineIndex - startLineIndex >= options.chunkLines || chars + nextLen > options.chunkChars)) {
        break;
      }
      chars += nextLen;
      endLineIndex++;
    }

    const chunkLines = lines.slice(startLineIndex, endLineIndex);
    const text = chunkLines.join('\n');
    const startLine = startLineIndex + 1;
    const endLine = endLineIndex;
    const id = `chunk-${String(chunks.length + 1).padStart(4, '0')}`;
    const charStart = lineStarts[startLineIndex] ?? 0;
    const lastLineIndex = Math.max(startLineIndex, endLineIndex - 1);
    const charEnd = (lineStarts[lastLineIndex] ?? charStart) + (lines[lastLineIndex] ?? '').length;
    chunks.push({
      id,
      startLine,
      endLine,
      charStart,
      charEnd,
      chars: text.length,
      hash: sha256Text(text),
      preview: previewText(text, options.previewChars),
      text,
    });
    startLineIndex = endLineIndex;
  }
  return chunks;
}

function extractOccurrences(chunks) {
  const seen = new Set();
  const occurrences = [];
  for (const chunk of chunks) {
    const lines = chunk.text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const candidate of collectCandidates(line)) {
        const term = normalizeTerm(candidate.term);
        if (!term) continue;
        const key = `${term}\0${chunk.id}\0${chunk.startLine + i}\0${candidate.column}`;
        if (seen.has(key)) continue;
        seen.add(key);
        occurrences.push({
          term,
          chunkId: chunk.id,
          line: chunk.startLine + i,
          column: candidate.column,
          reason: candidate.reason,
          kindHints: inferKindHints(term, candidate.reason),
        });
      }
    }
  }
  return occurrences;
}

function collectCandidates(line) {
  const candidates = [];
  collectRegex(candidates, line, /[一-龯々ヶ]{2,18}/gu, 'kanji-compound');
  collectRegex(candidates, line, /[ァ-ヶー]{2,24}/gu, 'katakana');
  collectRegex(candidates, line, /[A-Z][A-Za-z0-9_-]{1,32}/g, 'romanized');
  collectRegex(candidates, line, /[「『]([^」』]{2,32})[」』]/gu, 'quoted');
  collectRegex(
    candidates,
    line,
    /[一-龯々ヶぁ-んァ-ヶー]{1,18}(王国|帝国|共和国|都市|市|町|村|国|領|州|区|街|塔|城|宮|神殿|寺院|港|島|森|山|谷|川|海|湖|通り|広場|学院|砦|教団|騎士団|軍|隊|組織|評議会|商会|同盟|連盟|戦争|事件|儀式|作戦|計画)/gu,
    'suffix-pattern'
  );

  if (segmenter) {
    for (const part of segmenter.segment(line)) {
      if (part.isWordLike && part.segment.length >= 2) {
        candidates.push({ term: part.segment, column: part.index + 1, reason: 'segmenter' });
      }
    }
  }

  return candidates;
}

function collectRegex(candidates, line, regex, reason) {
  for (const match of line.matchAll(regex)) {
    const term = match[1] ?? match[0];
    const offset = match.index + (match[0].indexOf(term));
    candidates.push({ term, column: offset + 1, reason });
  }
}

function normalizeTerm(term) {
  const normalized = term
    .normalize('NFKC')
    .replace(/^[\s、。，．・:;!?！？「」『』（）()［\]【】"'`]+/u, '')
    .replace(/[\s、。，．・:;!?！？「」『』（）()［\]【】"'`]+$/u, '');
  if (normalized.length < 2 || normalized.length > 40) return null;
  if (/^\d+$/u.test(normalized)) return null;
  if (STOP_TERMS.has(normalized.toLowerCase())) return null;
  return normalized;
}

function inferKindHints(term, reason) {
  const hints = new Set();
  if (PLACE_SUFFIXES.some((suffix) => term.endsWith(suffix))) hints.add('place');
  if (GROUP_SUFFIXES.some((suffix) => term.endsWith(suffix))) hints.add('group');
  if (EVENT_SUFFIXES.some((suffix) => term.endsWith(suffix))) hints.add('event');
  if (reason === 'quoted') hints.add('special-term');
  if (reason === 'katakana' && term.length <= 8) hints.add('name-or-term');
  if (hints.size === 0) hints.add('unknown');
  return [...hints];
}

function buildTermIndex(occurrences) {
  const byTerm = new Map();
  const termsByChunk = new Map();

  for (const occurrence of occurrences) {
    if (!byTerm.has(occurrence.term)) {
      byTerm.set(occurrence.term, {
        term: occurrence.term,
        count: 0,
        chunkIds: new Set(),
        kindHints: new Set(),
        occurrences: [],
      });
    }
    const entry = byTerm.get(occurrence.term);
    entry.count++;
    entry.chunkIds.add(occurrence.chunkId);
    for (const hint of occurrence.kindHints) entry.kindHints.add(hint);
    if (entry.occurrences.length < 50) {
      entry.occurrences.push({
        chunkId: occurrence.chunkId,
        line: occurrence.line,
        column: occurrence.column,
        reason: occurrence.reason,
      });
    }

    if (!termsByChunk.has(occurrence.chunkId)) termsByChunk.set(occurrence.chunkId, new Set());
    termsByChunk.get(occurrence.chunkId).add(occurrence.term);
  }

  const cooccurs = buildCooccurs(termsByChunk);
  return [...byTerm.values()]
    .map((entry) => ({
      term: entry.term,
      count: entry.count,
      spread: entry.chunkIds.size,
      kindHints: [...entry.kindHints].sort(),
      occurrences: entry.occurrences,
      nearbyTerms: topNearby(cooccurs.get(entry.term)),
    }))
    .sort((a, b) => b.count - a.count || b.spread - a.spread || a.term.localeCompare(b.term));
}

function buildCooccurs(termsByChunk) {
  const cooccurs = new Map();
  for (const termSet of termsByChunk.values()) {
    const terms = [...termSet].slice(0, 200);
    for (const term of terms) {
      if (!cooccurs.has(term)) cooccurs.set(term, new Map());
      const related = cooccurs.get(term);
      for (const other of terms) {
        if (other === term) continue;
        related.set(other, (related.get(other) ?? 0) + 1);
      }
    }
  }
  return cooccurs;
}

function topNearby(nearby) {
  if (!nearby) return [];
  return [...nearby.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([term, count]) => ({ term, count }));
}

function buildSourceIndex({ sourceId, sourcePath, outputDir, sourceBuffer, normalizedText, sourceHash, chunks, workDir, options }) {
  return {
    id: sourceId,
    tool: TOOL_VERSION,
    generatedAt: new Date().toISOString(),
    source: {
      path: relativePath(outputDir, sourcePath),
      sha256: sourceHash,
      bytes: sourceBuffer.byteLength,
      chars: Array.from(normalizedText).length,
      lines: lineCount(normalizedText),
    },
    chunking: {
      chunkLines: options.chunkLines,
      chunkChars: options.chunkChars,
    },
    workdir: {
      path: relativePath(outputDir, workDir),
      status: 'available',
    },
    chunks: chunks.map(({ text: _text, ...chunk }) => ({
      ...chunk,
      workFile: relativePath(outputDir, join(workDir, 'chunks', `${chunk.id}.txt`)),
    })),
  };
}

function buildTermIndexJson({ sourceId, sourceHash, sourceIndexFile, terms, yumeTerms, occurrences, workDir, outputDir, options }) {
  return {
    id: `${sourceId}-terms`,
    tool: TOOL_VERSION,
    generatedAt: new Date().toISOString(),
    source: {
      sourceId,
      sourceHash,
      sourceIndexFile: `./${sourceIndexFile}`,
    },
    limits: {
      minCount: options.minCount,
      totalTerms: terms.length,
      exportedTerms: yumeTerms.length,
      totalOccurrences: occurrences.length,
    },
    workdir: {
      path: relativePath(outputDir, workDir),
      status: 'available',
      files: {
        terms: 'terms.raw.jsonl',
        occurrences: 'occurrences.jsonl',
      },
    },
    terms: yumeTerms,
  };
}

function buildManifest({ sourceId, sourcePath, outputDir, sourceHash, sourceBuffer, normalizedText, chunks, terms, yumeTerms, occurrences, workDir, options, outputs }) {
  return {
    tool: TOOL_VERSION,
    generatedAt: new Date().toISOString(),
    source: {
      id: sourceId,
      path: relativePath(outputDir, sourcePath),
      sha256: sourceHash,
      bytes: sourceBuffer.byteLength,
      chars: Array.from(normalizedText).length,
      lines: lineCount(normalizedText),
    },
    options: {
      chunkLines: options.chunkLines,
      chunkChars: options.chunkChars,
      previewChars: options.previewChars,
      maxYumeTerms: options.maxYumeTerms,
      minCount: options.minCount,
    },
    counts: {
      chunks: chunks.length,
      terms: terms.length,
      yumeTerms: yumeTerms.length,
      occurrences: occurrences.length,
    },
    workdir: relativePath(outputDir, workDir),
    outputs,
  };
}

function sourceIndexHead(index) {
  return `// @tags: novel ingest source-index chunk-index generated

export const SourceIndex = ${json(index)};

export default SourceIndex;
`;
}

function termIndexHead(index) {
  return `// @tags: novel ingest term-index occurrence-index generated
// @ref: ${index.source.sourceIndexFile}

export const TermIndex = ${json(index)};

export default TermIndex;
`;
}

function relationIndexHead({ sourceId, sourceHash, sourceIndexFile, termIndexFile, workdir, terms }) {
  const index = {
    id: `${sourceId}-relations`,
    tool: TOOL_VERSION,
    generatedAt: new Date().toISOString(),
    source: {
      sourceId,
      sourceHash,
      sourceIndexFile,
      termIndexFile,
    },
    workdir,
    status: 'awaiting-relation-description',
    rule: 'Start from term nodes only. Describe evidence-backed relations after inspecting focused source chunks.',
    nodes: terms.map((term) => ({
      term: term.term,
      count: term.count,
      spread: term.spread,
      kindHints: term.kindHints,
      sampleOccurrences: term.occurrences.slice(0, 5),
    })),
    relations: [],
    relationShape: {
      id: 'rel-000001',
      from: 'term',
      to: 'related term',
      kind: 'appears-with | belongs-to | located-in | uses | opposes | aliases | unknown',
      claim: 'small source-backed relation description',
      source: [{ chunkId: 'chunk-0001', lineStart: 1, lineEnd: 4 }],
      confidence: 'source | inferred | uncertain',
      status: 'draft',
    },
  };
  return `// @tags: novel ingest relation-index relation-graph generated
// @ref: ${sourceIndexFile}
// @ref: ${termIndexFile}

export const RelationIndex = ${json(index)};

export default RelationIndex;
`;
}

function factLogHead({ sourceId, sourceHash, sourceIndexFile, termIndexFile, relationIndexFile, workdir, extractionQueue }) {
  const log = {
    id: `${sourceId}-world-facts`,
    tool: TOOL_VERSION,
    generatedAt: new Date().toISOString(),
    source: {
      sourceId,
      sourceHash,
      sourceIndexFile,
      termIndexFile,
      relationIndexFile,
    },
    workdir,
    status: 'awaiting-ai-extraction',
    rule: 'Use the relation index as the next reading map. Keep redundant source-backed facts and merge later only for focused views.',
    facts: [],
    extractionQueue,
  };
  return `// @tags: novel ingest world-facts evidence-log generated
// @ref: ${sourceIndexFile}
// @ref: ${termIndexFile}
// @ref: ${relationIndexFile}

export const WorldFactLog = ${json(log)};

export default WorldFactLog;
`;
}

async function writeYumeFile(file, { blockId, type, head }) {
  await mkdir(dirname(file), { recursive: true });
  const runtimePath = runtimeSpecifierFor(file);
  if (existsSync(file)) {
    const parsed = parseBlock(await readFile(file, 'utf8'));
    if (parsed.block.id !== blockId || parsed.block.type !== type) {
      throw new Error(`refusing to overwrite ${file}: existing block is ${parsed.block.id}/${parsed.block.type}`);
    }
    if (parsed.head === head) return { file, mode: 'unchanged', changed: false };
    parsed.head = head;
    parsed.block.runtime = { name: 'yume', version: '001', path: runtimePath };
    await atomicWrite(file, serializeBlock(parsed));
    const committed = await commitManual(file, {
      note: {
        author: 'novel-source-ingest',
        kind: 'generated',
        text: `refresh ${type} from ${TOOL_VERSION}`,
      },
    });
    return { file, mode: 'updated', changed: committed.committed, hash: committed.newHash };
  }

  const ts = Date.now();
  const extracted = extractRefsAndTags(head);
  const block = {
    id: blockId,
    type,
    schemaVersion: 1,
    runtime: { name: 'yume', version: '001', path: runtimePath },
    api: ['commit', 'history', 'show', 'diff', 'validate', 'refs', 'tags', 'noteAdd', 'noteList'],
    versions: [{
      hash: hashContent(head, null, ts),
      prevHash: null,
      content: head,
      ts,
      refs: extracted.refs,
      tags: extracted.tags,
      applyId: null,
    }],
  };
  await atomicWrite(file, serializeBlock({ block, head, boot: bootSource(runtimePath) }));
  return { file, mode: 'created', changed: true, hash: block.versions[0].hash };
}

function bootSource(runtimePath) {
  return `if (import.meta.url === \`file://\${process.argv[1]}\`) {
  const path = __block.runtime.path ?? \`${runtimePath}\`;
  const rt = await import(path);
  await rt.cli(import.meta.url, __block, process.argv);
}`;
}

function runtimeSpecifierFor(outputFile) {
  const rel = relative(dirname(outputFile), RUNTIME_PATH).split(sep).join('/');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

async function writeJson(file, value) {
  await mkdir(dirname(file), { recursive: true });
  await atomicWrite(file, `${json(value)}\n`);
}

async function writeJsonl(file, rows) {
  await mkdir(dirname(file), { recursive: true });
  await atomicWrite(file, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''));
}

function printSummary({ chunks, terms, yumeTerms, occurrences, workDir, writes, cleanWorkdir }) {
  console.log(`chunks: ${chunks.length}`);
  console.log(`terms: ${terms.length} (${yumeTerms.length} embedded in yume)`);
  console.log(`occurrences: ${occurrences.length}`);
  console.log(`workdir: ${cleanWorkdir ? 'cleaned' : workDir}`);
  for (const write of writes) {
    console.log(`${write.mode}: ${write.file}`);
  }
}

function stripKnownExt(name) {
  const ext = extname(name);
  return ext ? name.slice(0, -ext.length) : name;
}

function safeStem(value) {
  const clean = value.normalize('NFKC').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return clean || 'novel';
}

function blockIdFromStem(stem, suffix) {
  const words = stem.match(/[A-Za-z0-9]+/g) ?? ['novel'];
  const base = words
    .map((word, index) => index === 0 ? word.toLowerCase() : capitalize(word.toLowerCase()))
    .join('');
  return `${base}${suffix}`;
}

function capitalize(word) {
  return word ? word[0].toUpperCase() + word.slice(1) : word;
}

function normalizeLineEndings(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function previewText(text, maxChars) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' / ')
    .slice(0, maxChars);
}

function lineCount(text) {
  if (text.length === 0) return 0;
  return text.split('\n').length;
}

function relativePath(fromDir, target) {
  const rel = relative(fromDir, target).split(sep).join('/');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function sha256Text(text) {
  return sha256(Buffer.from(text, 'utf8'));
}

function json(value) {
  return JSON.stringify(value, null, 2);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}
