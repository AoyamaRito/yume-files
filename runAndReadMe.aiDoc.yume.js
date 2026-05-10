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
    },
    {
      "hash": "f190427617a8c8544400d56de1e8bba8149f5e9c3b1725a4aad4a69849957226",
      "prevHash": "387ac0eee6ef95ca9c3af6f217cdf29de8bc5d48ccad2f598d300531b996f7b8",
      "content": "// runAndReadMe.aiDoc.yume.js - operational entrypoint for AI agents using yume-files\n//\n// AI entrypoint:\n//   1. Read this file before broad repository scanning.\n//   2. Use heavy, impact, and refs-check to keep context small and graph-aware.\n//   3. Use BLOCKFILE.aiDoc.yume.js when canonical format details are needed.\n//   4. Use README.md / docs/index.html for human-facing explanation.\n//\n// @ref: spec BLOCKFILE\n// @ref: example hello\n// @tags: ai-onboarding runbook yume-files context-economy\n\nexport const RunAndReadMe = {\n  name: \"yume-files AI runbook\",\n  purpose: [\n    \"Give an AI enough local context to operate .yume.js files without rereading the whole repository.\",\n    \"Preserve the design intent: one portable JavaScript file can carry current content, history, refs, tags, notes, and apply groups.\",\n    \"Keep runtime v001 dependency-free so .yume.js remains easy to inspect, copy, archive, and run in constrained AI environments.\"\n  ],\n\n  bootstrapInstruction: {\n    intent: \"Expand one short human instruction into the full yume-files operating contract for the current work session.\",\n    shortPromptJa: \"@yume-files を熟読して、理解した上で今後の指示をこなしてください。\",\n    fullPromptJa: [\n      \"@yume-files を熟読してください。\",\n      \"最初に AGENTS.md と runAndReadMe.aiDoc.yume.js を確認し、必要なときだけ BLOCKFILE.aiDoc.yume.js を参照してください。\",\n      \".yume.js の設計思想、filename.domain.yume.js の意味、HEAD / __block.versions / notes / applyId / refs / tags / runtime pinning を理解してください。\",\n      \"理解後、この会話内の今後の指示は yume-files の運用ルールに従って実行してください。\",\n      \"作業するときは、必要な文脈だけを heavy / impact / refs-check / notes-search / apply-search で取得し、編集後は validate、refs-check .、必要なら npm test まで確認してください。\",\n      \"変更内容、検証結果、残リスクを短く報告してください。\"\n    ],\n    shortPromptEn: \"Read @yume-files carefully, understand it, and use that understanding for the rest of my instructions.\",\n    fullPromptEn: [\n      \"Read @yume-files carefully.\",\n      \"Start with AGENTS.md and runAndReadMe.aiDoc.yume.js; consult BLOCKFILE.aiDoc.yume.js only when exact format semantics are needed.\",\n      \"Understand the design intent, filename.domain.yume.js domains, HEAD, __block.versions, notes, applyId, refs, tags, and runtime pinning.\",\n      \"For the rest of this work session, execute my instructions according to the yume-files operating rules.\",\n      \"Use heavy, impact, refs-check, notes-search, and apply-search to gather only the context needed.\",\n      \"After edits, run validate, refs-check ., and npm test when behavior or structure changed.\",\n      \"Report changes, verification, and remaining risk briefly.\"\n    ],\n    aiAcknowledgement: [\n      \"After reading, acknowledge with a short operational summary, not a long restatement.\",\n      \"State that future instructions in the session will be handled under this runbook unless the user overrides it.\",\n      \"If a task is ambiguous, make a conservative filename.domain.yume.js choice and explain it briefly.\"\n    ]\n  },\n\n  firstRead: [\n    \"Read AGENTS.md for repository-level working rules.\",\n    \"Read this runbook next; it is the operational map for AI agents.\",\n    \"Use README.md for the human-facing summary and examples.\",\n    \"Use BLOCKFILE.aiDoc.yume.js only when you need the canonical specification.\",\n    \"Use examples/hello.fn.yume.js as the smallest valid .yume.js sample.\"\n  ],\n\n  autoUseProtocol: {\n    readOrder: [\n      \"AGENTS.md\",\n      \"runAndReadMe.aiDoc.yume.js\",\n      \"README.md for human examples and public usage\",\n      \"examples/hello.fn.yume.js for the smallest valid shape\",\n      \"BLOCKFILE.aiDoc.yume.js only for canonical schema or runtime semantics\"\n    ],\n    understandingChecklist: [\n      \"A .yume.js file is a JavaScript module carrying current content, append-only content history, refs, tags, notes, apply groups, and a pinned runtime.\",\n      \"filename.domain.yume.js is semantic; the domain tells an AI how to treat the file.\",\n      \"Normal yume edits happen in HEAD, then runtime commit appends a new version.\",\n      \"__block.versions is not hand-edited during ordinary work.\",\n      \"notes are mutable commentary outside the version hash.\",\n      \"applyId ties multi-file AI operations together.\",\n      \"refs and tags form the retrieval and impact graph.\",\n      \"v001 runtime stays zero-dependency and avoids AST package dependencies.\"\n    ],\n    futureTaskLoop: [\n      \"Classify the user request: read, explain, create yume file, edit yume file, edit docs/site, inspect graph, or verify release readiness.\",\n      \"Gather the narrowest useful context first; prefer runbook, refs, tags, heavy, impact, notes-search, and apply-search over broad scanning.\",\n      \"If creating a yume file, choose a clear filename.domain.yume.js name and include refs/tags that future AI runs can use.\",\n      \"If editing a yume file, edit HEAD only and commit through the runtime.\",\n      \"If changing shared semantics, run impact before editing and refs-check after editing.\",\n      \"Finish with the verification level that matches risk: validate for touched yume files, refs-check . for graph changes, npm test for runtime or repository invariant changes.\"\n    ],\n    responseContract: [\n      \"Be concise and operational.\",\n      \"Do not dump the whole spec back to the user unless asked.\",\n      \"Report changed files, commands run, and whether validation passed.\",\n      \"Call out unresolved assumptions or residual risk.\"\n    ]\n  },\n\n  operatingModel: {\n    format: \"filename.domain.yume.js\",\n    domainMeaning: \"The domain segment tells an AI how to treat the file: fn, module, aiDoc, spec, workflow, template, world, style, character, and similar roles.\",\n    currentContent: \"The HEAD region is the live JavaScript/module content.\",\n    history: \"__block.versions is append-only history for the HEAD content.\",\n    mutableCommentary: \"__block.notes stores intent and review notes outside the version hash.\",\n    crossFileWork: \"applyId ties multiple file changes from one AI operation together.\",\n    graph: \"refs and tags extracted from HEAD make related-context and impact scans possible.\"\n  },\n\n  commandMap: {\n    validate: \"node <file>.yume.js validate\",\n    showHead: \"node <file>.yume.js show head\",\n    commitHead: \"node <file>.yume.js commit --note \\\"why this change exists\\\"\",\n    history: \"node <file>.yume.js history\",\n    refs: \"node <file>.yume.js refs\",\n    tags: \"node <file>.yume.js tags\",\n    heavy: \"node examples/hello.fn.yume.js heavy <block-id> 1 .\",\n    heavyApply: \"node examples/hello.fn.yume.js heavy-apply view.txt <block-id> 1 . --note \\\"AI edited view\\\"\",\n    impact: \"node examples/hello.fn.yume.js impact <block-id> 1 .\",\n    refsCheck: \"node examples/hello.fn.yume.js refs-check .\",\n    test: \"npm test\"\n  },\n\n  decisionRules: [\n    \"For a quick edit to one .yume.js file, inspect show head, edit only the HEAD region, then run commit.\",\n    \"For related context, prefer heavy over opening every file manually.\",\n    \"For change blast radius, run impact before editing a shared block.\",\n    \"For graph health, run refs-check after changing @ref, import/export, dynamic import, tags, or block ids.\",\n    \"For pure documentation outside .yume.js, update normal Markdown/HTML directly and keep .yume.js refs clean.\",\n    \"For a new domain file, choose filename.domain.yume.js so future AIs can infer its role from the path.\"\n  ],\n\n  yumeFileEditing: [\n    \"Do not hand-edit __block.versions unless repairing a broken file format deliberately.\",\n    \"Normal edits happen in HEAD; runtime commit appends the new version with hash, refs, tags, timestamp, and optional applyId.\",\n    \"Use note-add or commit --note for intent that should remain mutable.\",\n    \"Use rollback to append a restored version instead of deleting history.\",\n    \"Keep BOOT small and let it call the pinned runtime version declared in __block.runtime.version.\"\n  ],\n\n  contextEconomy: [\n    \"Start from this runbook instead of reading the entire repository.\",\n    \"Escalate to BLOCKFILE only for exact schema/runtime semantics.\",\n    \"Use refs, tags, heavy, impact, notes-search, and apply-search as retrieval tools before broad scanning.\",\n    \"Prefer one well-scoped .yume.js file over scattered prompts when capturing workflows, templates, specs, worlds, characters, or writing styles.\",\n    \"A compact yume file can reduce prompt tokens and preserve more reasoning budget for the actual task.\"\n  ],\n\n  designBoundaries: [\n    \"Do not add AST parser or package dependencies to runtime v001 unless the project deliberately changes that constraint.\",\n    \"Use conservative source scanning because the runtime must stay portable and dependency-free.\",\n    \"Treat warnings from refs-check as useful navigation signals, not always hard failures.\",\n    \"The runtime handle file is infrastructure; domain files are the portable knowledge/work units.\"\n  ],\n\n  doneCriteria: [\n    \"Changed .yume.js files validate.\",\n    \"refs-check . has no new unresolved path or duplicate-id errors.\",\n    \"npm test passes when runtime behavior or repository structure changes.\",\n    \"README/docs stay aligned when public usage changes.\"\n  ]\n};\n\nexport default RunAndReadMe;\n",
      "ts": 1778392612666,
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
      "applyId": "apply-2026-05-10-47bec14a"
    }
  ],
  "notes": {
    "apply:apply-2026-05-10-47bec14a": [
      {
        "id": "n-c65865b9-9ba6-44d7-84ea-c3a2aee51dd2",
        "author": "human",
        "ts": 1778392612671,
        "text": "add bootstrap instruction for AI session use"
      }
    ]
  }
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

  bootstrapInstruction: {
    intent: "Expand one short human instruction into the full yume-files operating contract for the current work session.",
    shortPromptJa: "@yume-files を熟読して、理解した上で今後の指示をこなしてください。",
    fullPromptJa: [
      "@yume-files を熟読してください。",
      "最初に AGENTS.md と runAndReadMe.aiDoc.yume.js を確認し、必要なときだけ BLOCKFILE.aiDoc.yume.js を参照してください。",
      ".yume.js の設計思想、filename.domain.yume.js の意味、HEAD / __block.versions / notes / applyId / refs / tags / runtime pinning を理解してください。",
      "理解後、この会話内の今後の指示は yume-files の運用ルールに従って実行してください。",
      "作業するときは、必要な文脈だけを heavy / impact / refs-check / notes-search / apply-search で取得し、編集後は validate、refs-check .、必要なら npm test まで確認してください。",
      "変更内容、検証結果、残リスクを短く報告してください。"
    ],
    shortPromptEn: "Read @yume-files carefully, understand it, and use that understanding for the rest of my instructions.",
    fullPromptEn: [
      "Read @yume-files carefully.",
      "Start with AGENTS.md and runAndReadMe.aiDoc.yume.js; consult BLOCKFILE.aiDoc.yume.js only when exact format semantics are needed.",
      "Understand the design intent, filename.domain.yume.js domains, HEAD, __block.versions, notes, applyId, refs, tags, and runtime pinning.",
      "For the rest of this work session, execute my instructions according to the yume-files operating rules.",
      "Use heavy, impact, refs-check, notes-search, and apply-search to gather only the context needed.",
      "After edits, run validate, refs-check ., and npm test when behavior or structure changed.",
      "Report changes, verification, and remaining risk briefly."
    ],
    aiAcknowledgement: [
      "After reading, acknowledge with a short operational summary, not a long restatement.",
      "State that future instructions in the session will be handled under this runbook unless the user overrides it.",
      "If a task is ambiguous, make a conservative filename.domain.yume.js choice and explain it briefly."
    ]
  },

  firstRead: [
    "Read AGENTS.md for repository-level working rules.",
    "Read this runbook next; it is the operational map for AI agents.",
    "Use README.md for the human-facing summary and examples.",
    "Use BLOCKFILE.aiDoc.yume.js only when you need the canonical specification.",
    "Use examples/hello.fn.yume.js as the smallest valid .yume.js sample."
  ],

  autoUseProtocol: {
    readOrder: [
      "AGENTS.md",
      "runAndReadMe.aiDoc.yume.js",
      "README.md for human examples and public usage",
      "examples/hello.fn.yume.js for the smallest valid shape",
      "BLOCKFILE.aiDoc.yume.js only for canonical schema or runtime semantics"
    ],
    understandingChecklist: [
      "A .yume.js file is a JavaScript module carrying current content, append-only content history, refs, tags, notes, apply groups, and a pinned runtime.",
      "filename.domain.yume.js is semantic; the domain tells an AI how to treat the file.",
      "Normal yume edits happen in HEAD, then runtime commit appends a new version.",
      "__block.versions is not hand-edited during ordinary work.",
      "notes are mutable commentary outside the version hash.",
      "applyId ties multi-file AI operations together.",
      "refs and tags form the retrieval and impact graph.",
      "v001 runtime stays zero-dependency and avoids AST package dependencies."
    ],
    futureTaskLoop: [
      "Classify the user request: read, explain, create yume file, edit yume file, edit docs/site, inspect graph, or verify release readiness.",
      "Gather the narrowest useful context first; prefer runbook, refs, tags, heavy, impact, notes-search, and apply-search over broad scanning.",
      "If creating a yume file, choose a clear filename.domain.yume.js name and include refs/tags that future AI runs can use.",
      "If editing a yume file, edit HEAD only and commit through the runtime.",
      "If changing shared semantics, run impact before editing and refs-check after editing.",
      "Finish with the verification level that matches risk: validate for touched yume files, refs-check . for graph changes, npm test for runtime or repository invariant changes."
    ],
    responseContract: [
      "Be concise and operational.",
      "Do not dump the whole spec back to the user unless asked.",
      "Report changed files, commands run, and whether validation passed.",
      "Call out unresolved assumptions or residual risk."
    ]
  },

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
