// @yume-format: 1

export const __block = {
  "id": "novelSourceIngestWorkflow",
  "type": "workflow",
  "schemaVersion": 1,
  "runtime": {
    "name": "yume",
    "version": "001",
    "path": "./runtimes/ver001.handle.yume.js"
  },
  "api": [
    "commit",
    "history",
    "show",
    "diff",
    "validate",
    "refs",
    "tags",
    "noteAdd",
    "noteList"
  ],
  "versions": [
    {
      "hash": "deeab23c410d8d3ab7ce0e91b5117b533d617a56ef9f88f1a0a20c689f19eb6e",
      "prevHash": null,
      "content": "// @tags: novel ingest workflow source-index term-index evidence-log intermediate-files\n\nexport const NovelSourceIngestWorkflow = {\n  id: \"novel-source-ingest\",\n  purpose: \"Read a long novel txt without forcing an eager clean world model.\",\n  coreHypothesis: \"The slow path is eager cleanup: extraction, deduplication, contradiction handling, naming cleanup, and schema polishing in one AI pass.\",\n  principle: \"Ingest first, normalize later.\",\n  artifacts: [\n    {\n      role: \"source-index\",\n      file: \"<stem>.source.index.yume.js\",\n      job: \"Store source hash, line count, stable chunk ids, chunk hashes, and short previews. Do not store the full txt.\"\n    },\n    {\n      role: \"term-index\",\n      file: \"<stem>.terms.index.yume.js\",\n      job: \"Store candidate terms, phrase occurrences, kind hints, nearby terms, and source chunk pointers.\"\n    },\n    {\n      role: \"evidence-log\",\n      file: \"<stem>.world.facts.yume.js\",\n      job: \"Store redundant source-backed facts. Duplicates and contradictions remain visible until a focused view needs them.\"\n    },\n    {\n      role: \"focused-view\",\n      file: \"<target>.character.yume.js | <target>.place.yume.js | <stem>.world.yume.js\",\n      job: \"Merge only the facts needed for one character, place, rule, event, or world slice.\"\n    }\n  ],\n  intermediateFiles: {\n    defaultDir: \".yume-work/<stem>-<runHash>/\",\n    keepByDefault: true,\n    cleanFlag: \"--clean-workdir\",\n    files: [\n      \"manifest.json\",\n      \"source.index.json\",\n      \"terms.index.json\",\n      \"occurrences.jsonl\",\n      \"terms.raw.jsonl\",\n      \"facts.raw.jsonl\",\n      \"chunks/chunk-0001.txt\"\n    ],\n    rules: [\n      \"Keep cache/intermediate files when debugging, resuming, or comparing changed source chunks.\",\n      \"It is acceptable to delete intermediates after successful output if the source txt and generated yume files are enough.\",\n      \"Never rely on intermediate files as the only copy of user source text.\",\n      \"Ignore .yume-work in Git unless a specific fixture is intentionally added.\"\n    ]\n  },\n  pipeline: [\n    {\n      step: 1,\n      name: \"source snapshot\",\n      output: \"source-index\",\n      rule: \"Hash and chunk the txt before asking an AI to understand it.\",\n      command: \"npm run ingest:novel -- input.txt --stem novel\"\n    },\n    {\n      step: 2,\n      name: \"term candidate extraction\",\n      output: \"term-index\",\n      rule: \"Extract more candidate words and phrases than needed. Classification is only a hint.\"\n    },\n    {\n      step: 3,\n      name: \"evidence fact extraction\",\n      output: \"evidence-log\",\n      rule: \"Use source chunks and term windows to write small facts with source pointers. Keep duplicates.\"\n    },\n    {\n      step: 4,\n      name: \"focused normalization\",\n      output: \"focused-view\",\n      rule: \"Normalize one target at a time, such as one character, place, group, event, or timeline slice.\"\n    },\n    {\n      step: 5,\n      name: \"incremental refresh\",\n      output: \"updated indexes and affected views\",\n      rule: \"Reprocess only chunks whose hash changed. Refresh views only when their evidence changed.\"\n    }\n  ],\n  agentRules: [\n    \"Do not promise a clean final world file as the first artifact for a long txt.\",\n    \"First create or update source-index and term-index.\",\n    \"Treat duplicate facts as evidence, not as cleanup debt.\",\n    \"When a fact is uncertain, keep it with confidence uncertain and source pointers.\",\n    \"Move from evidence-log to focused-view only when the target is known.\"\n  ],\n  qualityChecks: [\n    \"source-index has chunk ids, line ranges, hashes, and no full raw txt\",\n    \"term-index lets an AI jump from a term to source chunks\",\n    \"world facts are traceable to source chunks and line ranges\",\n    \"focused views separate merged facts, uncertain facts, and open conflicts\",\n    \"incremental runs do not redo unchanged chunks\"\n  ]\n};\n\nexport default NovelSourceIngestWorkflow;\n",
      "ts": 1778662800000,
      "refs": [],
      "tags": [
        "novel",
        "ingest",
        "workflow",
        "source-index",
        "term-index",
        "evidence-log",
        "intermediate-files"
      ],
      "applyId": null
    },
    {
      "hash": "647d7a6de7da0fe7e29a7d33e2e0191379abdb8d99505017790992f13b07934b",
      "prevHash": "deeab23c410d8d3ab7ce0e91b5117b533d617a56ef9f88f1a0a20c689f19eb6e",
      "content": "// @tags: novel ingest workflow source-index term-index relation-index evidence-log intermediate-files\n\nexport const NovelSourceIngestWorkflow = {\n  id: \"novel-source-ingest\",\n  purpose: \"Read a long novel txt without forcing an eager clean world model.\",\n  coreHypothesis: \"The slow path is eager cleanup: extraction, deduplication, contradiction handling, naming cleanup, and schema polishing in one AI pass.\",\n  principle: \"Ingest first, normalize later.\",\n  artifacts: [\n    {\n      role: \"source-index\",\n      file: \"<stem>.source.index.yume.js\",\n      job: \"Store source hash, line count, stable chunk ids, chunk hashes, and short previews. Do not store the full txt.\"\n    },\n    {\n      role: \"term-index\",\n      file: \"<stem>.terms.index.yume.js\",\n      job: \"Store candidate terms, phrase occurrences, kind hints, nearby terms, and source chunk pointers.\"\n    },\n    {\n      role: \"relation-index\",\n      file: \"<stem>.relations.index.yume.js\",\n      job: \"Start from term nodes with empty relations. Fill evidence-backed term relations after focused reading.\"\n    },\n    {\n      role: \"evidence-log\",\n      file: \"<stem>.world.facts.yume.js\",\n      job: \"Store redundant source-backed facts. Duplicates and contradictions remain visible until a focused view needs them.\"\n    },\n    {\n      role: \"focused-view\",\n      file: \"<target>.character.yume.js | <target>.place.yume.js | <stem>.world.yume.js\",\n      job: \"Merge only the facts needed for one character, place, rule, event, or world slice.\"\n    }\n  ],\n  intermediateFiles: {\n    defaultDir: \".yume-work/<stem>-<runHash>/\",\n    keepByDefault: true,\n    cleanFlag: \"--clean-workdir\",\n    files: [\n      \"manifest.json\",\n      \"source.index.json\",\n      \"terms.index.json\",\n      \"occurrences.jsonl\",\n      \"terms.raw.jsonl\",\n      \"relations.raw.jsonl\",\n      \"facts.raw.jsonl\",\n      \"chunks/chunk-0001.txt\"\n    ],\n    rules: [\n      \"Keep cache/intermediate files when debugging, resuming, or comparing changed source chunks.\",\n      \"It is acceptable to delete intermediates after successful output if the source txt and generated yume files are enough.\",\n      \"Never rely on intermediate files as the only copy of user source text.\",\n      \"Ignore .yume-work in Git unless a specific fixture is intentionally added.\"\n    ]\n  },\n  pipeline: [\n    {\n      step: 1,\n      name: \"source snapshot\",\n      output: \"source-index\",\n      rule: \"Hash and chunk the txt before asking an AI to understand it.\",\n      command: \"npm run ingest:novel -- input.txt --stem novel\"\n    },\n    {\n      step: 2,\n      name: \"term candidate extraction\",\n      output: \"term-index\",\n      rule: \"Extract more candidate words and phrases than needed. Classification is only a hint.\"\n    },\n    {\n      step: 3,\n      name: \"relation description\",\n      output: \"relation-index\",\n      rule: \"Create the relations file from term nodes first, then describe source-backed edges gradually.\"\n    },\n    {\n      step: 4,\n      name: \"evidence fact extraction\",\n      output: \"evidence-log\",\n      rule: \"Use source chunks, term windows, and relation edges to write small facts with source pointers. Keep duplicates.\"\n    },\n    {\n      step: 5,\n      name: \"focused normalization\",\n      output: \"focused-view\",\n      rule: \"Normalize one target at a time, such as one character, place, group, event, or timeline slice.\"\n    },\n    {\n      step: 6,\n      name: \"incremental refresh\",\n      output: \"updated indexes and affected views\",\n      rule: \"Reprocess only chunks whose hash changed. Refresh views only when their evidence changed.\"\n    }\n  ],\n  agentRules: [\n    \"Do not promise a clean final world file as the first artifact for a long txt.\",\n    \"First create or update source-index and term-index.\",\n    \"Create the relation-index as an empty graph from term nodes before writing world facts.\",\n    \"Treat duplicate facts as evidence, not as cleanup debt.\",\n    \"When a fact is uncertain, keep it with confidence uncertain and source pointers.\",\n    \"Move from evidence-log to focused-view only when the target is known.\"\n  ],\n  qualityChecks: [\n    \"source-index has chunk ids, line ranges, hashes, and no full raw txt\",\n    \"term-index lets an AI jump from a term to source chunks\",\n    \"relation-index starts with term nodes and empty relations before focused reading\",\n    \"world facts are traceable to source chunks and line ranges\",\n    \"focused views separate merged facts, uncertain facts, and open conflicts\",\n    \"incremental runs do not redo unchanged chunks\"\n  ]\n};\n\nexport default NovelSourceIngestWorkflow;\n",
      "ts": 1778668995966,
      "refs": [],
      "tags": [
        "novel",
        "ingest",
        "workflow",
        "source-index",
        "term-index",
        "relation-index",
        "evidence-log",
        "intermediate-files"
      ],
      "applyId": "apply-2026-05-13-0838aa7c"
    },
    {
      "hash": "911a11aea6c29cfd5e10a9cc45bde37bd2fdc3a1ba848b4e891b4dbbeddd27ce",
      "prevHash": "647d7a6de7da0fe7e29a7d33e2e0191379abdb8d99505017790992f13b07934b",
      "content": "// @tags: novel ingest workflow source-index term-index relation-index settings-catalog evidence-log intermediate-files\n\nexport const NovelSourceIngestWorkflow = {\n  id: \"novel-source-ingest\",\n  purpose: \"Read a long novel txt without forcing an eager clean world model.\",\n  coreHypothesis: \"The slow path is eager cleanup: extraction, deduplication, contradiction handling, naming cleanup, and schema polishing in one AI pass.\",\n  principle: \"Ingest first, normalize later.\",\n  artifacts: [\n    {\n      role: \"source-index\",\n      file: \"<stem>.source.index.yume.js\",\n      job: \"Store source hash, line count, stable chunk ids, chunk hashes, and short previews. Do not store the full txt.\"\n    },\n    {\n      role: \"term-index\",\n      file: \"<stem>.terms.index.yume.js\",\n      job: \"Store candidate terms, phrase occurrences, kind hints, nearby terms, and source chunk pointers.\"\n    },\n    {\n      role: \"relation-index\",\n      file: \"<stem>.relations.index.yume.js\",\n      job: \"Start from term nodes with empty relations. Fill evidence-backed term relations after focused reading.\"\n    },\n    {\n      role: \"settings-catalog\",\n      file: \"<stem>.settings.catalog.yume.js\",\n      job: \"Map terms to many settings collections and keep multiple index sources available for lookup.\"\n    },\n    {\n      role: \"settings-collection\",\n      file: \"<stem>.<collection>.settings.yume.js\",\n      job: \"Start as empty setting books such as world, characters, places, groups, objects, rules, and events.\"\n    },\n    {\n      role: \"evidence-log\",\n      file: \"<stem>.world.facts.yume.js\",\n      job: \"Store redundant source-backed facts. Duplicates and contradictions remain visible until a focused view needs them.\"\n    },\n    {\n      role: \"focused-view\",\n      file: \"<target>.character.yume.js | <target>.place.yume.js | <stem>.world.yume.js\",\n      job: \"Merge only the facts needed for one character, place, rule, event, or world slice.\"\n    }\n  ],\n  intermediateFiles: {\n    defaultDir: \".yume-work/<stem>-<runHash>/\",\n    keepByDefault: true,\n    cleanFlag: \"--clean-workdir\",\n    files: [\n      \"manifest.json\",\n      \"source.index.json\",\n      \"terms.index.json\",\n      \"occurrences.jsonl\",\n      \"terms.raw.jsonl\",\n      \"relations.raw.jsonl\",\n      \"facts.raw.jsonl\",\n      \"chunks/chunk-0001.txt\"\n    ],\n    rules: [\n      \"Keep cache/intermediate files when debugging, resuming, or comparing changed source chunks.\",\n      \"It is acceptable to delete intermediates after successful output if the source txt and generated yume files are enough.\",\n      \"Never rely on intermediate files as the only copy of user source text.\",\n      \"Ignore .yume-work in Git unless a specific fixture is intentionally added.\"\n    ]\n  },\n  pipeline: [\n    {\n      step: 1,\n      name: \"source snapshot\",\n      output: \"source-index\",\n      rule: \"Hash and chunk the txt before asking an AI to understand it.\",\n      command: \"npm run ingest:novel -- input.txt --stem novel\"\n    },\n    {\n      step: 2,\n      name: \"term candidate extraction\",\n      output: \"term-index\",\n      rule: \"Extract more candidate words and phrases than needed. Classification is only a hint.\"\n    },\n    {\n      step: 3,\n      name: \"relation description\",\n      output: \"relation-index\",\n      rule: \"Create the relations file from term nodes first, then describe source-backed edges gradually.\"\n    },\n    {\n      step: 4,\n      name: \"settings catalog creation\",\n      output: \"settings-catalog and empty settings collections\",\n      rule: \"Create many empty setting collections and a catalog so terms can point to multiple possible setting books.\"\n    },\n    {\n      step: 5,\n      name: \"evidence fact extraction\",\n      output: \"evidence-log\",\n      rule: \"Use source chunks, term windows, relation edges, and settings catalog lookup to write small facts with source pointers. Keep duplicates.\"\n    },\n    {\n      step: 6,\n      name: \"focused normalization\",\n      output: \"settings collection entries or focused-view\",\n      rule: \"Normalize one target at a time into the relevant setting collection. A term may belong to more than one collection.\"\n    },\n    {\n      step: 7,\n      name: \"incremental refresh\",\n      output: \"updated indexes and affected views\",\n      rule: \"Reprocess only chunks whose hash changed. Refresh views only when their evidence changed.\"\n    }\n  ],\n  agentRules: [\n    \"Do not promise a clean final world file as the first artifact for a long txt.\",\n    \"First create or update source-index and term-index.\",\n    \"Create the relation-index as an empty graph from term nodes before writing world facts.\",\n    \"Create the settings catalog and multiple empty settings collections before filling facts.\",\n    \"Allow a term to map to multiple collections and multiple index sources.\",\n    \"Treat duplicate facts as evidence, not as cleanup debt.\",\n    \"When a fact is uncertain, keep it with confidence uncertain and source pointers.\",\n    \"Move from evidence-log to focused-view only when the target is known.\"\n  ],\n  qualityChecks: [\n    \"source-index has chunk ids, line ranges, hashes, and no full raw txt\",\n    \"term-index lets an AI jump from a term to source chunks\",\n    \"relation-index starts with term nodes and empty relations before focused reading\",\n    \"settings catalog maps terms to candidate collections and preserves multiple index sources\",\n    \"settings collections start empty and can be filled independently\",\n    \"world facts are traceable to source chunks and line ranges\",\n    \"focused views separate merged facts, uncertain facts, and open conflicts\",\n    \"incremental runs do not redo unchanged chunks\"\n  ]\n};\n\nexport default NovelSourceIngestWorkflow;\n",
      "ts": 1778669384225,
      "refs": [],
      "tags": [
        "novel",
        "ingest",
        "workflow",
        "source-index",
        "term-index",
        "relation-index",
        "settings-catalog",
        "evidence-log",
        "intermediate-files"
      ],
      "applyId": "apply-2026-05-13-0d367a14"
    }
  ],
  "notes": {
    "apply:apply-2026-05-13-0838aa7c": [
      {
        "id": "n-b84daf37-d54a-4194-88b1-0dc4ccf6faab",
        "author": "codex",
        "ts": 1778668995970,
        "text": "add relation-index stage before world facts",
        "kind": "workflow"
      }
    ],
    "apply:apply-2026-05-13-0d367a14": [
      {
        "id": "n-a6316805-c1d1-4a8f-a175-29ae33f26833",
        "author": "codex",
        "ts": 1778669384229,
        "text": "add settings catalog stage for term lookup",
        "kind": "workflow"
      }
    ]
  }
};

// === HEAD ===
// @tags: novel ingest workflow source-index term-index relation-index settings-catalog evidence-log intermediate-files

export const NovelSourceIngestWorkflow = {
  id: "novel-source-ingest",
  purpose: "Read a long novel txt without forcing an eager clean world model.",
  coreHypothesis: "The slow path is eager cleanup: extraction, deduplication, contradiction handling, naming cleanup, and schema polishing in one AI pass.",
  principle: "Ingest first, normalize later.",
  artifacts: [
    {
      role: "source-index",
      file: "<stem>.source.index.yume.js",
      job: "Store source hash, line count, stable chunk ids, chunk hashes, and short previews. Do not store the full txt."
    },
    {
      role: "term-index",
      file: "<stem>.terms.index.yume.js",
      job: "Store candidate terms, phrase occurrences, kind hints, nearby terms, and source chunk pointers."
    },
    {
      role: "relation-index",
      file: "<stem>.relations.index.yume.js",
      job: "Start from term nodes with empty relations. Fill evidence-backed term relations after focused reading."
    },
    {
      role: "settings-catalog",
      file: "<stem>.settings.catalog.yume.js",
      job: "Map terms to many settings collections and keep multiple index sources available for lookup."
    },
    {
      role: "settings-collection",
      file: "<stem>.<collection>.settings.yume.js",
      job: "Start as empty setting books such as world, characters, places, groups, objects, rules, and events."
    },
    {
      role: "evidence-log",
      file: "<stem>.world.facts.yume.js",
      job: "Store redundant source-backed facts. Duplicates and contradictions remain visible until a focused view needs them."
    },
    {
      role: "focused-view",
      file: "<target>.character.yume.js | <target>.place.yume.js | <stem>.world.yume.js",
      job: "Merge only the facts needed for one character, place, rule, event, or world slice."
    }
  ],
  intermediateFiles: {
    defaultDir: ".yume-work/<stem>-<runHash>/",
    keepByDefault: true,
    cleanFlag: "--clean-workdir",
    files: [
      "manifest.json",
      "source.index.json",
      "terms.index.json",
      "occurrences.jsonl",
      "terms.raw.jsonl",
      "relations.raw.jsonl",
      "facts.raw.jsonl",
      "chunks/chunk-0001.txt"
    ],
    rules: [
      "Keep cache/intermediate files when debugging, resuming, or comparing changed source chunks.",
      "It is acceptable to delete intermediates after successful output if the source txt and generated yume files are enough.",
      "Never rely on intermediate files as the only copy of user source text.",
      "Ignore .yume-work in Git unless a specific fixture is intentionally added."
    ]
  },
  pipeline: [
    {
      step: 1,
      name: "source snapshot",
      output: "source-index",
      rule: "Hash and chunk the txt before asking an AI to understand it.",
      command: "npm run ingest:novel -- input.txt --stem novel"
    },
    {
      step: 2,
      name: "term candidate extraction",
      output: "term-index",
      rule: "Extract more candidate words and phrases than needed. Classification is only a hint."
    },
    {
      step: 3,
      name: "relation description",
      output: "relation-index",
      rule: "Create the relations file from term nodes first, then describe source-backed edges gradually."
    },
    {
      step: 4,
      name: "settings catalog creation",
      output: "settings-catalog and empty settings collections",
      rule: "Create many empty setting collections and a catalog so terms can point to multiple possible setting books."
    },
    {
      step: 5,
      name: "evidence fact extraction",
      output: "evidence-log",
      rule: "Use source chunks, term windows, relation edges, and settings catalog lookup to write small facts with source pointers. Keep duplicates."
    },
    {
      step: 6,
      name: "focused normalization",
      output: "settings collection entries or focused-view",
      rule: "Normalize one target at a time into the relevant setting collection. A term may belong to more than one collection."
    },
    {
      step: 7,
      name: "incremental refresh",
      output: "updated indexes and affected views",
      rule: "Reprocess only chunks whose hash changed. Refresh views only when their evidence changed."
    }
  ],
  agentRules: [
    "Do not promise a clean final world file as the first artifact for a long txt.",
    "First create or update source-index and term-index.",
    "Create the relation-index as an empty graph from term nodes before writing world facts.",
    "Create the settings catalog and multiple empty settings collections before filling facts.",
    "Allow a term to map to multiple collections and multiple index sources.",
    "Treat duplicate facts as evidence, not as cleanup debt.",
    "When a fact is uncertain, keep it with confidence uncertain and source pointers.",
    "Move from evidence-log to focused-view only when the target is known."
  ],
  qualityChecks: [
    "source-index has chunk ids, line ranges, hashes, and no full raw txt",
    "term-index lets an AI jump from a term to source chunks",
    "relation-index starts with term nodes and empty relations before focused reading",
    "settings catalog maps terms to candidate collections and preserves multiple index sources",
    "settings collections start empty and can be filled independently",
    "world facts are traceable to source chunks and line ranges",
    "focused views separate merged facts, uncertain facts, and open conflicts",
    "incremental runs do not redo unchanged chunks"
  ]
};

export default NovelSourceIngestWorkflow;

// === /HEAD ===

// === BOOT ===
if (import.meta.url === `file://${process.argv[1]}`) {
  const path = __block.runtime.path ?? `./runtimes/ver${__block.runtime.version}.handle.yume.js`;
  const rt = await import(path);
  await rt.cli(import.meta.url, __block, process.argv);
}
// === /BOOT ===
