// @yume-format: 1

export const __block = {
  "id": "runAndReadMe",
  "type": "aiDoc",
  "schemaVersion": 1,
  "runtime": {
    "name": "yume",
    "version": "001"
  },
  "api": [
    "commit",
    "history",
    "heavy",
    "heavyApply",
    "show",
    "diff",
    "rollback",
    "validate",
    "refs",
    "tags",
    "impact",
    "refsCheck",
    "noteAdd",
    "noteList",
    "notesSearch",
    "applyList",
    "applySearch"
  ],
  "versions": [
    {
      "hash": "387ac0eee6ef95ca9c3af6f217cdf29de8bc5d48ccad2f598d300531b996f7b8",
      "prevHash": null,
      "content": "// runAndReadMe.aiDoc.yume.js - operational entrypoint for AI agents using yume-files\n//\n// AI entrypoint:\n//   1. Read this file before broad repository scanning.\n//   2. Use heavy, impact, and refs-check to keep context small and graph-aware.\n//   3. Use BLOCKFILE.aiDoc.yume.js when canonical format details are needed.\n//   4. Use README.md / docs/index.html for human-facing explanation.\n//\n// @ref: spec BLOCKFILE\n// @ref: example hello\n// @tags: ai-onboarding runbook yume-files context-economy\n\nexport const RunAndReadMe = {\n  name: \"yume-files AI runbook\",\n  purpose: [\n    \"Give an AI enough local context to operate .yume.js files without rereading the whole repository.\",\n    \"Preserve the design intent: one portable JavaScript file can carry current content, history, refs, tags, notes, and apply groups.\",\n    \"Keep runtime v001 dependency-free so .yume.js remains easy to inspect, copy, archive, and run in constrained AI environments.\"\n  ],\n\n  firstRead: [\n    \"Read AGENTS.md for repository-level working rules.\",\n    \"Read this runbook next; it is the operational map for AI agents.\",\n    \"Use README.md for the human-facing summary and examples.\",\n    \"Use BLOCKFILE.aiDoc.yume.js only when you need the canonical specification.\",\n    \"Use examples/hello.fn.yume.js as the smallest valid .yume.js sample.\"\n  ],\n\n  operatingModel: {\n    format: \"filename.domain.yume.js\",\n    domainMeaning: \"The domain segment tells an AI how to treat the file: fn, module, aiDoc, spec, workflow, template, world, style, character, and similar roles.\",\n    currentContent: \"The HEAD region is the live JavaScript/module content.\",\n    history: \"__block.versions is append-only history for the HEAD content.\",\n    mutableCommentary: \"__block.notes stores intent and review notes outside the version hash.\",\n    crossFileWork: \"applyId ties multiple file changes from one AI operation together.\",\n    graph: \"refs and tags extracted from HEAD make related-context and impact scans possible.\"\n  },\n\n  commandMap: {\n    validate: \"node <file>.yume.js validate\",\n    showHead: \"node <file>.yume.js show head\",\n    commitHead: \"node <file>.yume.js commit --note \\\"why this change exists\\\"\",\n    history: \"node <file>.yume.js history\",\n    refs: \"node <file>.yume.js refs\",\n    tags: \"node <file>.yume.js tags\",\n    heavy: \"node examples/hello.fn.yume.js heavy <block-id> 1 .\",\n    heavyApply: \"node examples/hello.fn.yume.js heavy-apply view.txt <block-id> 1 . --note \\\"AI edited view\\\"\",\n    impact: \"node examples/hello.fn.yume.js impact <block-id> 1 .\",\n    refsCheck: \"node examples/hello.fn.yume.js refs-check .\",\n    test: \"npm test\"\n  },\n\n  decisionRules: [\n    \"For a quick edit to one .yume.js file, inspect show head, edit only the HEAD region, then run commit.\",\n    \"For related context, prefer heavy over opening every file manually.\",\n    \"For change blast radius, run impact before editing a shared block.\",\n    \"For graph health, run refs-check after changing @ref, import/export, dynamic import, tags, or block ids.\",\n    \"For pure documentation outside .yume.js, update normal Markdown/HTML directly and keep .yume.js refs clean.\",\n    \"For a new domain file, choose filename.domain.yume.js so future AIs can infer its role from the path.\"\n  ],\n\n  yumeFileEditing: [\n    \"Do not hand-edit __block.versions unless repairing a broken file format deliberately.\",\n    \"Normal edits happen in HEAD; runtime commit appends the new version with hash, refs, tags, timestamp, and optional applyId.\",\n    \"Use note-add or commit --note for intent that should remain mutable.\",\n    \"Use rollback to append a restored version instead of deleting history.\",\n    \"Keep BOOT small and let it call the pinned runtime version declared in __block.runtime.version.\"\n  ],\n\n  contextEconomy: [\n    \"Start from this runbook instead of reading the entire repository.\",\n    \"Escalate to BLOCKFILE only for exact schema/runtime semantics.\",\n    \"Use refs, tags, heavy, impact, notes-search, and apply-search as retrieval tools before broad scanning.\",\n    \"Prefer one well-scoped .yume.js file over scattered prompts when capturing workflows, templates, specs, worlds, characters, or writing styles.\",\n    \"A compact yume file can reduce prompt tokens and preserve more reasoning budget for the actual task.\"\n  ],\n\n  designBoundaries: [\n    \"Do not add AST parser or package dependencies to runtime v001 unless the project deliberately changes that constraint.\",\n    \"Use conservative source scanning because the runtime must stay portable and dependency-free.\",\n    \"Treat warnings from refs-check as useful navigation signals, not always hard failures.\",\n    \"The runtime handle file is infrastructure; domain files are the portable knowledge/work units.\"\n  ],\n\n  doneCriteria: [\n    \"Changed .yume.js files validate.\",\n    \"refs-check . has no new unresolved path or duplicate-id errors.\",\n    \"npm test passes when runtime behavior or repository structure changes.\",\n    \"README/docs stay aligned when public usage changes.\"\n  ]\n};\n\nexport default RunAndReadMe;\n",
      "ts": 1778391033588,
      "refs": [
        {
          "kind": "spec",
          "target": "BLOCKFILE"
        },
        {
          "kind": "example",
          "target": "hello"
        }
      ],
      "tags": [
        "ai-onboarding",
        "runbook",
        "yume-files",
        "context-economy"
      ],
      "applyId": null
    }
  ]
};

// === HEAD ===
// runAndReadMe.aiDoc.yume.js - operational entrypoint for AI agents using yume-files
//
// AI entrypoint:
//   1. Read this file before broad repository scanning.
//   2. Use heavy, impact, and refs-check to keep context small and graph-aware.
//   3. Use BLOCKFILE.aiDoc.yume.js when canonical format details are needed.
//   4. Use README.md / docs/index.html for human-facing explanation.
//
// @ref: spec BLOCKFILE
// @ref: example hello
// @tags: ai-onboarding runbook yume-files context-economy

export const RunAndReadMe = {
  name: "yume-files AI runbook",
  purpose: [
    "Give an AI enough local context to operate .yume.js files without rereading the whole repository.",
    "Preserve the design intent: one portable JavaScript file can carry current content, history, refs, tags, notes, and apply groups.",
    "Keep runtime v001 dependency-free so .yume.js remains easy to inspect, copy, archive, and run in constrained AI environments."
  ],

  firstRead: [
    "Read AGENTS.md for repository-level working rules.",
    "Read this runbook next; it is the operational map for AI agents.",
    "Use README.md for the human-facing summary and examples.",
    "Use BLOCKFILE.aiDoc.yume.js only when you need the canonical specification.",
    "Use examples/hello.fn.yume.js as the smallest valid .yume.js sample."
  ],

  operatingModel: {
    format: "filename.domain.yume.js",
    domainMeaning: "The domain segment tells an AI how to treat the file: fn, module, aiDoc, spec, workflow, template, world, style, character, and similar roles.",
    currentContent: "The HEAD region is the live JavaScript/module content.",
    history: "__block.versions is append-only history for the HEAD content.",
    mutableCommentary: "__block.notes stores intent and review notes outside the version hash.",
    crossFileWork: "applyId ties multiple file changes from one AI operation together.",
    graph: "refs and tags extracted from HEAD make related-context and impact scans possible."
  },

  commandMap: {
    validate: "node <file>.yume.js validate",
    showHead: "node <file>.yume.js show head",
    commitHead: "node <file>.yume.js commit --note \"why this change exists\"",
    history: "node <file>.yume.js history",
    refs: "node <file>.yume.js refs",
    tags: "node <file>.yume.js tags",
    heavy: "node examples/hello.fn.yume.js heavy <block-id> 1 .",
    heavyApply: "node examples/hello.fn.yume.js heavy-apply view.txt <block-id> 1 . --note \"AI edited view\"",
    impact: "node examples/hello.fn.yume.js impact <block-id> 1 .",
    refsCheck: "node examples/hello.fn.yume.js refs-check .",
    test: "npm test"
  },

  decisionRules: [
    "For a quick edit to one .yume.js file, inspect show head, edit only the HEAD region, then run commit.",
    "For related context, prefer heavy over opening every file manually.",
    "For change blast radius, run impact before editing a shared block.",
    "For graph health, run refs-check after changing @ref, import/export, dynamic import, tags, or block ids.",
    "For pure documentation outside .yume.js, update normal Markdown/HTML directly and keep .yume.js refs clean.",
    "For a new domain file, choose filename.domain.yume.js so future AIs can infer its role from the path."
  ],

  yumeFileEditing: [
    "Do not hand-edit __block.versions unless repairing a broken file format deliberately.",
    "Normal edits happen in HEAD; runtime commit appends the new version with hash, refs, tags, timestamp, and optional applyId.",
    "Use note-add or commit --note for intent that should remain mutable.",
    "Use rollback to append a restored version instead of deleting history.",
    "Keep BOOT small and let it call the pinned runtime version declared in __block.runtime.version."
  ],

  contextEconomy: [
    "Start from this runbook instead of reading the entire repository.",
    "Escalate to BLOCKFILE only for exact schema/runtime semantics.",
    "Use refs, tags, heavy, impact, notes-search, and apply-search as retrieval tools before broad scanning.",
    "Prefer one well-scoped .yume.js file over scattered prompts when capturing workflows, templates, specs, worlds, characters, or writing styles.",
    "A compact yume file can reduce prompt tokens and preserve more reasoning budget for the actual task."
  ],

  designBoundaries: [
    "Do not add AST parser or package dependencies to runtime v001 unless the project deliberately changes that constraint.",
    "Use conservative source scanning because the runtime must stay portable and dependency-free.",
    "Treat warnings from refs-check as useful navigation signals, not always hard failures.",
    "The runtime handle file is infrastructure; domain files are the portable knowledge/work units."
  ],

  doneCriteria: [
    "Changed .yume.js files validate.",
    "refs-check . has no new unresolved path or duplicate-id errors.",
    "npm test passes when runtime behavior or repository structure changes.",
    "README/docs stay aligned when public usage changes."
  ]
};

export default RunAndReadMe;

// === /HEAD ===

// === BOOT ===
if (import.meta.url === `file://${process.argv[1]}`) {
  const path = __block.runtime.path ?? `./runtimes/ver${__block.runtime.version}.handle.yume.js`;
  const rt = await import(path);
  await rt.cli(import.meta.url, __block, process.argv);
}
// === /BOOT ===
