// v2/AiRunAndRead_BLOCKFILE.js
// .yume.js — 履歴内蔵 JS ファイル形式の正典(Architecture D: vendored multi-version runtime + self-declared API)
//
// ⚠️ ファイル名 prefix `AiRunAndRead_` の意味:
//   1. `node AiRunAndRead_BLOCKFILE.js` で実行 → 出力を読め
//   2. or `import { Schema, Header, Head, Boot, ... } from './AiRunAndRead_BLOCKFILE.js'`
//   ⛔ .js ソースを prose として linear に読むな
//
// **canonical form**: this file (.js) ← REAL(Markdown は派生)
// **lab name**: BLOCKFILE(ai-desk 内部の engine 用語、Block 抽象に対応)
// **surface name**: yume file(出荷時 identifier、user-facing)
//
// 思想: AiRunAndRead_BIBLE.js
// 規律: AiRunAndRead_ONBOARDING.js
// 操作: AiRunAndRead_MANUAL.js
//
// 🚨 この仕様の **第一目的**は「履歴管理」ではなく **yume を継続的に version up させる substrate**。
//     - 防御面(durability): JS parser だけで読める、ai-desk/yume runtime 不在でも history 閲覧可能
//     - 攻め面(evolvability): runtime version pinning で古い folder/file を壊さず yume を進化させられる
//     両者は「substrate が安定、runtime は自由に進化」という同じ構造から導出される。

export const VERSION = "0.3-draft";
export const DATE = "2026-05-08";
export const STATUS = "draft, v001 partial reference runtime implemented in yume-files(show/diff/rollback/refs/tags/notes/search/apply/folder apply scan included)";

// ============================================================
// §0 動機と一行定義
// ============================================================
export const Purpose = {
  oneLine:
    ".yume.js = 自分の version 履歴を自分の中に持ち、co-located multi-version runtime から自分の version に応じた runtime を選んで自己修正する単一 JS ファイル。",
  primaryMechanism:
    "yume を継続的に version up させるための substrate。HTML / JSON / Markdown が数十年生きた pattern(substrate stable, parser evolves)を yume に適用する操作。",
  defenseSide: {
    label: "Durability(読める保証)",
    claim: "file は JS parser だけで読める。yume runtime が消えても history は閲覧可能。ECMA spec が崩れない限り永続。",
  },
  offenseSide: {
    label: "Evolvability(壊さず進化)",
    claim: "runtime version pinning で古い folder/file を壊さず yume を進化させられる。breaking change は新 version runtime に閉じ込められ、既存 file は影響を受けない。",
  },
  secondaryGoal:
    "Folder portability — `mv folder/` 一発で file + 全 runtime version + 履歴が移動する配布 unit。",
  why: [
    "sidecar 方式は engine version に lock-in、opaque store",
    "1 file 内蔵にすれば JS substrate 上に乗る = ECMA spec が崩れない限り永続的に readable",
    "AI は 1 file 開けば履歴 + refs + tags 全部 spotlight 内 = A0/A1/Spotlight と完全一致",
    "yume が pivot しても残る形式 = 公理体系を真に外部化する操作",
    "yume の upgrade が user file を破壊しない = 普及版に必須の安定性",
  ]
};

// ============================================================
// §1 ファイル識別 — 拡張子 + header marker(二重化)
// ============================================================
export const Header = {
  extension: {
    canonical: ".yume.js",
    rationale: [
      ".js のサブセットとして node の解決にそのまま乗る(loader hook 不要)",
      "glob `**/*.yume.js` で全 yume file を一発列挙",
      "`mv foo.yume.js foo.js` で普通の JS に戻る(逆も同じ) = substrate 互換",
      "yume = 出荷面 brand。ai-desk lab は内部、user に届く format identifier は yume 一本に振る",
      ".aijs / .bjs 系の独自拡張子は ecosystem cost が高く却下",
    ],
    must: false,  // 拡張子は recommended、識別の本体は header marker
  },
  marker: {
    line: "// @yume-format: 1",
    placement: "ファイル先頭から 5 行以内",
    rationale: [
      "拡張子なし環境(stdin pipe / clipboard / rename 事故)でも識別可能",
      "file 名 = 視認性、header = 内在的 identity の二段構え",
      "version 番号 1, 2, 3 ... で format 進化を表現(runtime version とは別軸、これは format spec 自体の version)",
      "extension と一致させて surface coherence を最大化",
    ],
    must: true,
  },
  threeAxesOfVersion: {
    note: "yume には 3 つの version 軸があり、互いに独立。混同しない。",
    axes: {
      "@yume-format (header)": "file 全体の format 規約 version(HEAD/BOOT marker / __block 配置等の物理形式)",
      "__block.schemaVersion":  "__block field shape の version(field 追加 / 意味調整等の logical schema)",
      "__block.runtime.version": "対応 runtime file の version('001', '002' ... runtime 実装の世代)",
    },
  },
};

// ============================================================
// §2 __block スキーマ(REAL の本体)
// ============================================================
export const Schema = {
  // 必須フィールド
  required: {
    id:            "string — Block 識別子(folder 内 unique)",
    type:          "string — 'fn' | 'class' | 'module' | 'doc' | 'constraint' | 'observation' | ...",
    schemaVersion: "number — __block schema 自体の version。現行は 1",
    runtime:       "object — runtime 解決情報(§4 参照)",
    versions:      "Version[] — append-only、これが REAL の本体(§3 参照)",
  },
  // 任意フィールド
  optional: {
    api:   "string[] — file が runtime に期待する verb の宣言。**freeform**(canonical list 固定なし)、ヒント情報。例: ['commit', 'history', 'show', 'diff', 'rollback', 'validate', 'noteAdd', 'notesSearch', 'applyList']",
    meta:  "object — 任意の付加情報(author / created / 等)。挙動には影響しない",
    notes: "object — SHADOW commentary layer。{ [versionHash | 'apply:<applyId>']: Note[] }(§3.5 参照)",
  },
  encoding: {
    rule: "`export const __block = <JSON object literal>;` を canonical とする(JSON object は JS object literal としても valid)。",
    why: "reader が __block を評価実行せず JSON.parse できるようにするため。未信頼 file を読む時の安全境界。",
    v001: "v001 runtime は __block 内の single quote / trailing comma / computed expression / function call を受け付けない。",
  },
  // 禁止事項
  forbidden: [
    "Block.content / refs / children / tags をフィールドとして直接書かない(SHADOW、head() 派生のみ)",
    "versions の途中要素を書き換えない(append-only、commit() 経由のみ)",
    "hash / prevHash を手で改変しない",
    "__block に JS 式 / function call / computed value を書かない(canonical JSON のみ)",
    "Version に message / comment / description 等の immutable text フィールドを後付けしない(§3 設計判断)",
  ],
  example: `
export const __block = {
  "id": "foo",
  "type": "fn",
  "schemaVersion": 1,
  "runtime": { "name": "yume", "version": "001" },
  "api": ["commit", "history", "show", "diff", "rollback", "validate", "refs", "tags", "noteAdd", "noteList", "notesSearch", "applyList", "applyShow", "applyIndex", "applySearch"],
  "versions": [
    { "hash": "abc123", "prevHash": null,     "content": "export function foo(x){return x;}",      "ts": 1714000000000, "refs": [], "tags": [], "applyId": null },
    { "hash": "def456", "prevHash": "abc123", "content": "export function foo(x){return x + 1;}",  "ts": 1714100000000, "refs": [], "tags": [], "applyId": "apply-2026-05-08-xyz" }
  ],
  "notes": {
    "def456": [{ "id": "n-1", "author": "ai", "ts": 1714100000000, "text": "incremented return value", "kind": "ai-reasoning" }]
  },
  "meta": { "author": "okii", "created": "2026-05-08" }
};
  `,
};

// ============================================================
// §2.5 Role Taxonomy(file 名による役割分類)
// ============================================================
export const RoleTaxonomy = {
  premise:
    "file 名で role を表現する。`<name>.<role>.yume.js` 規約により、file system 上で全 yume file の役割が一発で見える。" +
    "All-as-Block(§A5)を file system レベルで物理化する操作。",
  pattern: "<name>.<role>.yume.js",
  standardRoles: {
    handle:      "runtime / verb dispatcher。例: ver001.handle.yume.js",
    aiDoc:       "LLM 向け正典 doc。例: BIBLE.aiDoc.yume.js / ONBOARDING.aiDoc.yume.js",
    fn:          "関数 Block。例: foo.fn.yume.js",
    module:      "module Block。例: app.module.yume.js",
    doc:         "human-facing doc。例: CHANGELOG.doc.yume.js",
    constraint:  "制約 Block(§A2 Constraint Folding)。例: rules.constraint.yume.js",
    observation: "観測 Block(eyes 系)。例: render.observation.yume.js",
  },
  rules: [
    "role は __block.type と一致させる(例: foo.fn.yume.js なら type: 'fn')",
    "role 名は freeform、上記は標準セット。新 role を追加する時は spec OpenQuestions に挙げる",
    "role が file 名に無い yume file(`foo.yume.js`)も valid、role は __block.type 単独で表現される",
    "role 不一致(file 名 .fn.yume.js だが __block.type が 'module')は warning、ただし fail しない(naming は convention、本体は __block.type)",
  ],
  benefits: [
    "`**/*.handle.yume.js` で全 runtime、`**/*.aiDoc.yume.js` で全 AI doc が glob 一発列挙",
    "AI が file 名読んだ瞬間に role 把握 = Spotlight 内で routing 即決",
    "folder layout が self-describing 系統樹になる(yume project = 役割明示された yume file の集合)",
  ],
  bootstrapNote: {
    point: "v001 では runtime(.handle.yume.js)は plain JS module(__block なし、versions なし)。",
    why: "runtime 自身を full .yume.js 化(__block 持ち、自己 commit 可能)するのは bootstrap 問題(yume を起動するのに yume が要る)を生む。",
    futurePath: "v00N で runtime の自己 yume 化(完全 recursion)を再評価、§17 OpenQuestions 参照",
    practical: "v001 の `.handle.yume.js` は naming convention のみ、中身は通常の export 集合(parseBlock / commit / cli ... 等の verb 関数を export)",
  },
};

// ============================================================
// §3 Version エントリの形(versions[] の各要素)
// ============================================================
export const Version = {
  fields: {
    hash:     "string — content + prevHash + ts の hash(衝突検知 + 改ざん検知)",
    prevHash: "string | null — 直前 version の hash、最初は null(A4 Sequential Hashing)",
    content:  "string — その version の HEAD region body(JS source として valid)",
    ts:       "number — Unix epoch ms",
    refs:     "Ref[] — { kind, target }、依存先(import / calls / contains / observes / ...)",
    tags:     "string[] — // @tags: コメントから抽出される意味タグ",
    applyId:  "string | null — 同 recompress で生まれた version 群の group id(§16 CodecModel)。単独 commit なら null",
  },
  rules: [
    "全フィールドは JSON-serializable な原始型のみ(永続性の保証)",
    "content は文字列のみ。AST / function reference 等は持たない",
    "schemaVersion 拡張時は **additive only**。既存フィールドの意味変更禁止",
    "未知フィールドは旧 reader が ignore する(graceful degradation)",
  ],
  designDecision_NoMessageField: {
    rule: "Version に message / comment / description 等の immutable text フィールドを **持たない**。",
    why: [
      "git commit message の構造的失敗を引き継がないため",
      "  - immutable text を commit に baked-in する → 後から正せない、stale 化必至",
      "  - 「今書け」圧力で雑な message が量産される(`fix`, `wip` の山)",
      "  - 後で改善したくても hash 変わる = 履歴改ざんと同義、trade-off が壊れてる",
      "yume では WHAT / WHY を分離する:",
      "  - WHAT(immutable) = versions[].content + diff",
      "  - WHY(mutable)   = notes layer(§3.5)",
      "AI に毎 commit で message 生成を強いない = LLM-First / 普及版にも優しい",
      "「commit message が雑」問題が field 不在により原理的に発生しない",
    ],
  },
};

// ============================================================
// §3.5 Note エントリと notes layer(SHADOW commentary、git notes 相当)
// ============================================================
export const Note = {
  premise:
    "Note は version への付箋。versions(REAL、append-only)とは独立した SHADOW commentary layer。" +
    "後から自由に add / edit / remove 可能(git notes と同じ性質)。version の hash 計算に **含まれない**。",
  schema: {
    id:     "string — note の identity(uuid 推奨、edit 追跡用)",
    author: "'ai' | 'human' | 'system'",
    ts:     "number — Unix epoch ms(最終更新時刻)",
    text:   "string — 自由記述",
    kind:   "string | undefined — 任意 namespace。'intent' / 'review' / 'bookmark' / 'ai-reasoning' 等、default は undefined",
  },
  storage: {
    location: "__block.notes(object)",
    keyShape: [
      "<versionHash>           — 特定 version への付箋",
      "apply:<applyId>         — recompress group 全体への付箋(複数 file 跨ぎ)",
    ],
    valueShape: "Note[](その key に attach された付箋の配列)",
    example: `
__block.notes = {
  'abc123': [
    { id: 'n-1', author: 'ai', ts: 1714..., text: 'changed signature to accept array', kind: 'ai-reasoning' },
    { id: 'n-2', author: 'human', ts: 1714..., text: 'this is for the demo', kind: 'intent' },
  ],
  'apply:apply-2026-05-08-xyz': [
    { id: 'n-3', author: 'ai', ts: 1714..., text: 'refactored render + format together', kind: 'intent' },
  ],
}
    `,
  },
  invariants: [
    "notes は mutable(versions と違って後から編集可能)",
    "version の hash 計算に notes は含まれない = note を編集しても version hash は不変",
    "A4 Event Sourcing は versions に閉じ、notes は別 layer",
    "notes は 1 file 内に閉じる(folder 跨ぎ参照なし、substrate durability 維持)",
    "applyId は key prefix `apply:` で namespace 分け、versionHash と衝突しない",
  ],
  whyMutable: [
    "commentary は fluid、commit message を immutable にした git の失敗を引き継がない",
    "「あの時の意図、後から書き足したい」が普通にできる",
    "「あの note 間違えてた」も hash を壊さず修正可能",
    "trade-off: 誰がいつ何を edit したかの audit trail は失われる(v002 で notes 自体の history を検討)",
  ],
  recompressIntegration: {
    note: "recompress は note を optional 引数で受ける。note なしが default。",
    flow: "note 付き recompress → 全 affected version に同じ applyId が振られ、その applyId に note が attach される",
    signature: "recompress(fileUrls, rootId, editedView, depth, { note?: { author, text, kind? } }) → {...}",
  },
};

// ============================================================
// §4 runtime 解決(co-located multi-version runtime、convention-based)
// ============================================================
export const Runtime = {
  field: {
    name:    "string — 'yume' 固定(将来の互換 runtime 識別用)",
    version: "string — '001', '002', '003' ... の zero-padded sequential。runtime file 選択の入力",
    path:    "string | undefined — explicit override(任意)。未指定なら convention から自動計算",
  },
  resolution: {
    convention: "./yume/ver${version}.handle.yume.js  (file からの relative、§2.5 Role Taxonomy 参照)",
    rule: [
      "1. __block.runtime.path が明示されていればそれを使う(override)",
      "2. なければ ./yume/ver${runtime.version}.handle.yume.js を resolution",
      "3. それも不在なら fail loud",
    ],
    why: [
      "version は metadata でなく **runtime file 選択の入力**として動く",
      "convention で path を計算 = file は version だけ宣言、簡素",
      "explicit path も残す = 例外的配置(node_modules / 別 folder 共有 等)に対応",
      "fallback chain は許さない(`mv` 後の non-determinism 防止)",
    ],
    onMissing: "fail loud — `yume v${version} runtime not found at ${expectedPath}` 形式で exit",
  },
  multiVersionCoexistence: {
    model: "1 folder に N runtime version が共存可能。各 file が自分の runtime version を pin。",
    layout: "yume/ folder 配下に ver001.handle.yume.js / ver002.handle.yume.js / ver003.handle.yume.js ... を並列配置",
    rationale: [
      "yume v002 ship 後も v001 file は ver001.handle.yume.js のまま動く = breaking change が既存 file を壊さない",
      "user は file 単位で upgrade(`yume upgrade foo.fn.yume.js --to=002`)、folder 一括強制ではない",
      "Python venv / iOS deployment target / Docker base image と同型の version pinning モデル",
    ],
  },
  versionPinning: {
    semantic:
      "file の __block.runtime.version は 'この file はこの version の runtime で読まれる前提'を宣言する。" +
      "runtime はこの宣言と自身の VERSION を比較し、互換でなければ refuse する。",
    why: "yume が v10 に進化しても 5 年前の folder は v001 で動き続ける = 普及版に必須の安定性",
  },
};

// ============================================================
// §5 HEAD region(SHADOW、編集領域)
// ============================================================
export const Head = {
  markers: {
    begin: "// === HEAD ===",
    end:   "// === /HEAD ===",
  },
  semantics: {
    role: "head().content の source 展開(SHADOW)。普段の編集はここを書き換える。",
    relation: "REAL は __block.versions[末尾].content。HEAD region はその string を JS source として展開した姿。",
    invariant:
      "reconcile 後は HEAD region と head().content が等価でなければならない。" +
      "差があれば未 commit の編集が存在する状態(= dirty)。",
  },
  rules: [
    "HEAD region 内は普通の valid JS module body。export / import / class / function 何でも",
    "marker を file 内に複数置かない(BEGIN-END pair は 1 組のみ)",
    "marker の前後にコメントを置いてもよいが、HEAD region 抽出は厳密に marker 行で区切る",
    "HEAD region が無い file は __block の存在に関わらず .yume.js として invalid",
    "ESM 前提(top-level import / export を使う)。CommonJS は spec 外",
  ],
  rationale: [
    "eval を使わない — tooling(eslint / TS-LSP / git diff)が普通に効く",
    "AI は HEAD region を普段通り編集すればよい、hash chain を意識する必要がない(= LLM-First)",
    "REAL(versions)と SHADOW(HEAD region)の分離が file レベルで物理化される(A3/A6)",
  ]
};

// ============================================================
// §6 BOOT region(任意、self-invocation を有効化する 3 行)
// ============================================================
export const Boot = {
  markers: {
    begin: "// === BOOT ===",
    end:   "// === /BOOT ===",
  },
  template: `
// === BOOT ===
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  const path = __block.runtime.path ?? \`./yume/ver\${__block.runtime.version}.handle.yume.js\`;
  const rt = await import(path);
  await rt.cli(import.meta.url, __block, process.argv);
}
// === /BOOT ===
  `,
  semantics: {
    role: "node foo.fn.yume.js <verb> で self-invocation を有効にする。runtime(handle file)に委譲するだけの数行。",
    optional: "BOOT 不在でも file は valid。外部 CLI(`node yume/ver001.handle.yume.js commit foo.fn.yume.js`)で代替可能。",
    nodeCompat: "`import.meta.url === \\`file://${process.argv[1]}\\`` は Node の self-invocation 判定 idiom。Deno の `import.meta.main` は Node では undefined のため使わない。",
  },
  rules: [
    "BOOT 内に reconcile / commit / hash 計算等の logic を書かない(全部 runtime 側)",
    "BOOT は委譲のみ。fat-file は §0 substrate durability に反する",
    "BOOT を書く場合は HEAD region の **後** に置く(HEAD は編集領域、BOOT は固定 boilerplate)",
    "ESM 前提(top-level await + dynamic import)。CommonJS は対応外",
  ],
};

// ============================================================
// §7 Substrate Durability の階層保証
// ============================================================
export const Durability = {
  layers: [
    {
      level: 1,
      requires: "JS parser のみ",
      can: ["__block 全 versions の閲覧", "history の解釈", "content / refs / tags の取得"],
      cannot: ["self-modify(commit)", "rollback", "reconcile"],
    },
    {
      level: 2,
      requires: "JS parser + folder 内 runtime",
      can: ["上記すべて", "commit", "rollback", "reconcile", "atomic write back"],
      cannot: [],
    },
  ],
  guarantee: [
    "level 1 は ECMA spec が崩れない限り永続的に保証される",
    "level 2 は __block.runtime.version に対応する runtime が folder 内にある限り保証される",
    "ai-desk が forked / 死亡 / 互換切れになっても level 1 は影響を受けない",
    "LLM の training data に JS が含まれる限り、LLM は level 1 を読める",
  ],
};

// ============================================================
// §8 Folder = 配布 unit(multi-version runtime co-located、role-tagged)
// ============================================================
export const Folder = {
  layout: `
my-yume-project/
├── yume/                                # vendored runtime 群(N versions co-located、role=handle)
│   ├── ver001.handle.yume.js
│   ├── ver002.handle.yume.js
│   ├── ver003.handle.yume.js
│   └── ...
├── BIBLE.aiDoc.yume.js                   # AI doc(role=aiDoc)
├── ONBOARDING.aiDoc.yume.js              # 同上
├── foo.fn.yume.js                        # 関数 Block(role=fn)、runtime.version='001' → ver001.handle.yume.js
├── bar.module.yume.js                    # module Block(role=module)
├── baz.fn.yume.js                        # 関数 Block、runtime.version='002' → ver002.handle.yume.js
└── (他の通常 .js / 資料 / 等)
  `,
  rules: [
    "1 folder に N runtime version が共存可能(yume/ subfolder 内に並列配置)",
    "各 .yume.js は自分の runtime.version を declare、対応する ./yume/ver${version}.handle.yume.js を選ぶ",
    "別 runtime version の file が同 folder に混在しても OK(これが default 想定)",
    "folder ごと `mv` / `cp` / `git push` で移動可能、他の依存なし",
    "global install(npm i -g)は不要、推奨もしない",
    "未使用 runtime version の削除は明示操作(`yume gc-runtime ./` 等で参照されてないものだけ削除)",
    "role suffix は §2.5 RoleTaxonomy 参照、folder 内が self-describing 系統樹になる",
  ],
  rationale: [
    "ai-desk arch では file 数が構造的に抑制されるため(A1 + Constraint Folding)、runtime 重複の絶対量は問題にならない",
    "yume の version up が既存 file を壊さない pattern を folder layout で物理的に保証",
    "Python venv が python3.9 / 3.10 / 3.11 を共存させるのと同型の構造",
  ],
};

// ============================================================
// §9 Lifecycle(編集 → version up、default flow と boundary case)
// ============================================================
export const Lifecycle = {
  defaultFlow: {
    name: "Codec round-trip(§16 CodecModel)",
    description:
      "AI を通すと decompress → 編集 → recompress が起き、その中で版 up が自動発火。" +
      "通常使用ではこの flow しか発生しない、明示 commit verb は不要。",
    seeAlso: "§16 CodecModel",
  },
  boundaryCase: {
    name: "commitManual(AI を通さない人手編集の救済)",
    when: "AI を経由せず human / 外部 tool が HEAD region を直接書き換えた稀ケース",
    trigger: "node foo.fn.yume.js commit  (BOOT 経由)  or  node yume/ver001.handle.yume.js commit foo.fn.yume.js  (外部)",
    steps: [
      "1. file を読む",
      "2. __block を parse し、schema + hash chain を validate",
      "3. HEAD region を抽出",
      "4. head().content と HEAD region を比較",
      "5. 差があれば new Version を構築:",
      "   - content = HEAD region body",
      "   - prevHash = 現 head().hash",
      "   - ts = Date.now()",
      "   - hash = sha256(content + prevHash + ts)",
      "   - refs / tags は HEAD region から再抽出",
      "   - applyId = null(単独 commit、recompress group 不在)",
      "6. __block.versions に append",
      "7. atomic write back(tmp file → rename)",
    ],
    onClean: "差がない場合は何もせず exit 0",
  },
  edit: {
    who: "AI または human(supervisor)",
    where: "HEAD region 内のみ",
    invariant: "編集中は HEAD region と head().content が乖離する(dirty 状態)",
  },
  rollback: {
    trigger: "node foo.fn.yume.js rollback <hash>  または  rollback -1(直前へ)",
    steps: [
      "1. 指定 hash の version content を取得",
      "2. それを HEAD region に書き戻す(versions は **削除しない**、append-only)",
      "3. 書き戻しは新 version として commit される(rollback も history に残る)",
    ],
    rationale: "破壊的 rollback(versions を切り詰める)は A4 違反。rollback も append として時間軸に残す",
  },
  history: {
    trigger: "node foo.fn.yume.js history",
    output: "versions[] を時系列で表示(hash 短縮表示 + ts + refs 数 + applyId + 関連 notes 件数)",
  },
  hashAlgorithm: {
    rule: "sha256(content + '\\n' + (prevHash ?? '') + '\\n' + ts) を hex 化",
    why: "衝突実用安全 + Node crypto 標準対応 + 短すぎず長すぎない、log 出力で先頭 7 文字短縮表示も可能",
    validation: "validate は各 Version の hash 再計算と prevHash chain の連結を検査する",
  },
};

// ============================================================
// §10 Atomic Write と並行性
// ============================================================
export const Concurrency = {
  atomicWrite: {
    method: "tmp file を exclusive 作成 → write → fsync → rename(POSIX rename は atomic)",
    why: "途中 crash で file 半壊を防ぐ(substrate durability の最低保証)",
    must: true,
  },
  lock: {
    method: "foo.fn.yume.js.lock を exclusive create で作成、process 終了時に token 一致を確認して削除",
    content: "lock file 内容は { pid: number, ts: number, host: string, token: string }(JSON)、stale 検出と所有者確認に使う",
    onConflict: "既存 .lock があれば fail loud(pid / ts / host を含めて表示)",
    staleRecovery: {
      trigger: "lock.ts が現在から 1 時間以上前 OR lock.pid のプロセスが既に死んでいる",
      action: "stale lock を warning 付きで自動削除、新 lock を取得して続行",
      rationale: "process 異常終了時の lock 残存を救済、ただし削除は明示的 warning(silent ではない)",
    },
    must: true,
  },
  notes: [
    "git の concurrent edit と同じ問題、同じ対策で十分",
    "高頻度の並行 commit は想定しない(human-driven workflow)",
  ],
};

// ============================================================
// §11 git との関係
// ============================================================
export const Git = {
  granularity: {
    git: "repo 単位の snapshot(file 全体の checkpoint)",
    yumeFile: "function 単位の event log(commit 一回 = 1 version)",
    relation: "粒度が異なるため競合せず役割分担。両方使える。",
  },
  practicalNotes: [
    "commit 毎に file 全体に diff が出る(__block.versions が成長するため) — これは仕様、許容する",
    ".gitattributes で `*.yume.js diff=yumefile` 等の custom diff driver を後日定義可能(任意)",
    "merge: HEAD region の merge は普通の text merge、versions のマージは yume runtime 側で hash chain を rebase する logic が将来必要(現 spec には含めない)",
    "yume/ver*.handle.yume.js も commit 対象。runtime 自体が repo に入る = 将来 clone した時に依存解決不要",
  ],
};

// ============================================================
// §12 Taboos(やってはいけない)
// ============================================================
export const Taboos = [
  { no: "versions を直接書き換える",                      yes: "commit() 経由のみ append" },
  { no: "hash / prevHash を手で書き換える",                yes: "runtime に計算させる" },
  { no: "BOOT region に reconcile logic を inline する",   yes: "runtime に委譲、BOOT は 3 行" },
  { no: "fallback chain で runtime を探す",                yes: "convention(./yume/yume_v${version}.js)または explicit path、不在なら fail loud" },
  { no: "symlink で runtime 共有",                         yes: "folder ごとに vendor、yume/yume_v*.js を物理配置" },
  { no: "runtime version を file から省略",                 yes: "__block.runtime.version は required、補完しない" },
  { no: "HEAD region 外で content を編集",                  yes: "編集は HEAD region 内のみ、外は __block と BOOT のみ" },
  { no: "HEAD region に複数の begin/end pair",             yes: "1 組のみ、抽出は厳密 marker 一致" },
  { no: "schemaVersion 拡張で既存フィールドの意味変更",      yes: "additive only、未知 field は ignore で graceful degradation" },
  { no: "rollback で versions を切り詰める",               yes: "rollback も新 version として append" },
  { no: "Version に message / comment / description フィールドを追加する",   yes: "commentary は __block.notes に書く(§3.5、git notes 相当、mutable)" },
  { no: "notes を versions の hash 計算に含める",            yes: "notes は SHADOW、hash chain から完全分離(notes 編集で version hash を壊さない)" },
  { no: "notes を folder 跨ぎ参照で外部 file に持つ",         yes: "1 file に閉じる(substrate durability)" },
];

// ============================================================
// §13 最小有効 file の例
// ============================================================
export const MinimalExample = `
// @yume-format: 1
// foo.fn.yume.js — minimal valid yume file(role=fn)

export const __block = {
  "id": "foo",
  "type": "fn",
  "schemaVersion": 1,
  "runtime": {
    "name": "yume",
    "version": "001"
  },
  "api": ["commit", "history", "show", "diff", "rollback", "validate", "refs", "tags", "noteAdd", "noteEdit", "noteRm", "noteList", "notesSearch", "applyList", "applyShow", "applyIndex", "applySearch"],
  "versions": [
    {
      "hash": "75f051c18c0415b5d5af267581834e21a850f4d3cca46c817b5432f17dc393f0",
      "prevHash": null,
      "content": "export function foo(x) {\\n  return x;\\n}",
      "ts": 1714000000000,
      "refs": [],
      "tags": [],
      "applyId": null
    }
  ]
};

// === HEAD ===
export function foo(x) {
  return x;
}
// === /HEAD ===

// === BOOT ===
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  const path = __block.runtime.path ?? \`./yume/ver\${__block.runtime.version}.handle.yume.js\`;
  const rt = await import(path);
  await rt.cli(import.meta.url, __block, process.argv);
}
// === /BOOT ===
`;

// ============================================================
// §14 yume runtime に必要な API(spec 第二段階で別 file)
// ============================================================
export const RuntimeApiSurface = {
  // --- Codec(中心、§16 参照)---
  decompress: "(fileUrls: string[], rootId: string, depth: number) => Promise<string>  — alias of heavy",
  recompress: "(fileUrls: string[], rootId: string, editedView: string, depth: number, opts?: {note?: {author,text,kind?}}) => Promise<{updated: string[], unchanged: string[], applyId: string, newHashes: Record<string,string>}>  — alias of heavyApply、note attach optional",
  heavy:      "(fileUrls: string[], rootId: string, depth: number) => Promise<string>  — codec decompress の実体名(ai-desk v2 互換)",
  heavyApply: "(fileUrls: string[], rootId: string, content: string, depth: number, opts?: {note?: {...}}) => Promise<{...}>  — codec recompress の実体名",

  // --- Read(versions / notes 閲覧、副作用なし)---
  history:    "(fileUrl) => Promise<Version[]>  — 時系列で versions を返す",
  show:       "(fileUrl, hashOrIdx = 'head') => Promise<Version>  — 特定 version 取得",
  diff:       "(fileUrl, hashA = '-2', hashB = '-1') => Promise<string>  — 2 version 間の text diff",
  refs:       "(fileUrl) => Promise<Ref[]>  — 最新 version の outgoing refs",
  tags:       "(fileUrl) => Promise<string[]>  — 最新 version の tags",
  impact:     "(fileUrls: string[], rootId: string) => Promise<string[]>  — backward 推移閉包",
  validate:   "(fileUrl) => Promise<{ok: boolean, errors: string[]}>  — schema + hash chain 検査",
  parseBlock: "(source: string) => {block, head, boot}  — pure parser、副作用なし",
  serializeBlock: "({block, head, boot}) => string  — round-trip 保証",
  extractRefsAndTags: "(content: string) => {refs: Ref[], tags: string[]}  — HEAD region から import / export-from / dynamic import / bare calls / // @tags: を抽出",

  // --- Notes(§3.5、git notes 相当、mutable)---
  noteAdd:    "(fileUrl, key: hash | 'apply:<id>', note: {author,text,kind?}) => Promise<{noteId: string}>",
  noteEdit:   "(fileUrl, key, noteId: string, patch: {text?, kind?}) => Promise<void>",
  noteRm:     "(fileUrl, key, noteId: string) => Promise<void>",
  noteList:   "(fileUrl, key?) => Promise<Array<Note & {key: string}>>  — key 省略時は全 notes",
  notesSearch:"(folder: string, query: string) => Promise<{file, key, note}[]>  — folder 横断本文検索",

  // --- Boundary(AI を通さない人手編集の救済)---
  commitManual: "(fileUrl, opts?: {applyId?: string, note?: {author,text,kind?}}) => Promise<{committed: boolean, newHash?: string, applyId?: string | null}>  — HEAD region と head().content の差を手動で reconcile、稀ケース",
  rollback:     "(fileUrl, target: string | number, opts?: {applyId?, note?}) => Promise<{newHash: string, targetHash: string, applyId: string | null}>  — 指定 version content を新 version として append",

  // --- Apply(applyId group 閲覧、副作用なし)---
  applyList: "(fileUrl) => Promise<{applyId: string, versions: Version[], noteCount: number}[]>",
  applyShow: "(fileUrl, applyId: string) => Promise<{applyId: string, versions: Version[], notes: Note[]}>",
  applyIndex: "(folder) => Promise<{applyId: string, files: {file, relativeFile, blockId, versions, notes}[], fileCount: number, versionCount: number, noteCount: number}[]>  — folder 内の apply group を scan",
  applySearch: "(folder, applyId) => Promise<{applyId: string, files: [...], fileCount: number, versionCount: number, noteCount: number}>  — 複数 file 横断 apply 検索",

  // --- Lifecycle(yume 進化、§15 参照)---
  upgrade:     "(fileUrl, targetVersion: string) => Promise<{newHash: string, runtimeFrom: string, runtimeTo: string}>",
  list:        "(folder: string) => Promise<{file: string, version: string, headHash: string}[]>",
  gcRuntime:   "(folder: string) => Promise<{removed: string[]}>  — 参照されてない yume_v*.js を削除",

  // --- CLI dispatcher ---
  cli: "(fileUrl, block, argv) => Promise<void>  — BOOT から呼ばれる verb dispatch entry",

  detailNote: "詳細仕様は AiRunAndRead_YUME_RUNTIME.js(別 file)で定義予定。本 file は data format のみ扱う。",
};

// ============================================================
// §15 Yume Evolution Model(yume という製品が version up し続けるための規律)
// ============================================================
export const YumeEvolutionModel = {
  premise: [
    "yume は ai-desk(lab、実験プロダクト)を engine とする普及版",
    "普及版に必須の品質は『過去に作られた user の file が壊れない』こと",
    "そのために file format は engine の version up から **decoupled** されている必要がある",
  ],
  pattern: {
    name: "Substrate stable, runtime evolves",
    examples: [
      "HTML: tag spec evolves, browser parsers evolve, 30 年前の HTML page も今読める",
      "JSON: format additive only, parser libraries evolve",
      "Markdown: text degrades gracefully, renderer evolves",
      "Python venv: 3.9 / 3.10 / 3.11 が同 system に共存、project が pin",
      "iOS deployment target: app が想定 OS version を declare、新 OS でも動く",
    ],
    appliedToYume:
      ".yume.js は JS substrate に乗り、__block schema は additive only、runtime は version 番号で分岐実装。" +
      "過去の file は過去の runtime を選ぶ、これが既存 file を壊さない構造的保証。",
  },
  upgradeFlow: {
    perFile: [
      "1. yume v002 ship → yume/yume_v002.js を folder に配置",
      "2. user が任意 file を選んで `yume upgrade foo.yume.js --to=002` を実行",
      "3. runtime: foo.yume.js の versions / HEAD を読み、v001 → v002 schema migration を適用",
      "4. new commit を append、__block.runtime.version を '002' に更新",
      "5. 以降 foo.yume.js は yume_v002.js で動く",
    ],
    perFolder: "明示的に `yume upgrade ./` で全 file を bump 可能だが、default は per-file。一括 upgrade は user が要求した時だけ。",
    onError: "migration が失敗した file は old version のままロールバック、folder 全体の整合性を保つ",
  },
  breakingChangeDiscipline: [
    "schema 拡張は additive only(major version 跨ぎでも基本姿勢)",
    "verb の意味変更 / 削除は必ず major version up + migration tool 提供とセット",
    "古い runtime は folder に残せば永遠に動く = breaking change の重圧から yume が解放される",
    "yume が v100 になっても v001 file は v001 runtime で動く、これが普及版の永続契約",
  ],
  whyThisMatters: [
    "「user の作った物が将来も動く」という保証なしに普及版は成立しない",
    "engine version up を user に押し付けない = trust の根本",
    "yume が pivot しても data 部は JS parser だけで読める = ultimate fallback",
    "yume が成功して 10 年 / 20 年続いた時、最初に作られた .yume.js が今も動くこと、これが target",
  ],
};

// ============================================================
// §16 Codec Model(.yume.js = 圧縮形式、AI を通す = version up)
// ============================================================
export const CodecModel = {
  premise:
    ".yume.js は圧縮形式とみなせる。AI が触る瞬間に decompress → 編集 → recompress の round-trip が起き、" +
    "その結果として新 version が必然的に生まれる。明示 commit 動詞は AI 介在の通常 flow から消える。",
  primitives: {
    decompress: {
      signature: "(fileUrls, rootId, depth) → expandedView: string",
      role: "root + forward closure を 1 string に展開、AI に渡す",
      implementation: "ai-desk v2 の heavy(fileUrls, rootId, depth) と等価、codec 視点の命名 alias",
    },
    recompress: {
      signature: "(fileUrls, rootId, editedView, depth, opts?: {note?: {author,text,kind?}}) → {updated, unchanged, applyId, newHashes}",
      role: "戻り string を parse → 各 file に逆配分 → 差があれば新 version を append、同 applyId を全 affected version に振る",
      implementation: "ai-desk v2 の heavyApply(fileUrls, rootId, content, depth) と等価、codec 視点の命名 alias",
      noteIntegration: "opts.note を渡すと、生成された applyId に note が attach される(__block.notes['apply:'+applyId] に push)。note なしが default。",
    },
  },
  invariants: [
    "codec round-trip = version up(差があれば)",
    "差がなければ no-op(idempotent、AI が見ただけで version は増えない)",
    "明示 commit 動詞は AI を通常 flow に置く限り不要 — recompress が出口で自動発火",
    "recompress は edit 有無を comparison で判定、副作用は差があった file のみ",
  ],
  flow: `
file (compressed)
   │
   ├── decompress(heavy) ──→ expandedView: string
   │                                │
   │                                ▼
   │                            AI 編集
   │                                │
   │                                ▼
file' (compressed, +1 version) ←── recompress(heavyApply) ←── editedView: string
  `,
  whyThisFraming: [
    "AI を通すたびに自動的に history が積まれる = 「いつ何が起きたか」が常に記録される(A4 Event Sourcing と一致)",
    "user は「AI に頼んだ → 動いた」だけで version up が起きる、commit を意識しない = LLM-First 純粋化",
    "ai-desk の Virtual Heavy Function はまさにこの codec、それを概念として spec に正典化",
    "普及版(yume)の user model 核心メッセージ:「.yume.js は AI に通すたびに version up する」",
    "「圧縮形式」という比喩は user に対しても自然(zip / tar.gz の発展形と理解可能)",
  ],
  outOfBandEditing: {
    case: "AI を通さず human が HEAD region を直接編集した(default flow ではない、稀ケース)",
    handling: "recompress の代わりに boundary verb `commit-manual`(または単に `commit`)で reconcile",
    behavior: "差があれば append、なければ no-op。codec を通った場合と意味的に等価",
    rationale: "AI を通さない編集も version up path として救済する、ただし default ではない",
  },
  relationToYumeEvolution: {
    note: "Codec Model は file 内 versions の version up 機序、Yume Evolution Model は runtime の version up 機序。粒度が違うが思想は同じ(round-trip で進化、過去を壊さず append)。",
    comparison: [
      "Codec: file 内 __block.versions に append、runtime version は据え置き",
      "Yume Evolution: runtime version を bump、yume_v001 → yume_v002 の migration を適用",
      "通常使用は Codec のみで回る、Yume Evolution は明示 upgrade 操作時のみ発動",
    ],
  },
};

// ============================================================
// §17 未決事項(draft 段階で残してる)
// ============================================================
export const OpenQuestions = [
  "delta 圧縮 vs full content per version: versions[].content は full string が default だが、巨大化すると file が膨らむ。delta + N 毎に full snapshot の hybrid を後日検討",
  "refs の自動抽出範囲: v001 は軽量 scan で import/export-from/dynamic import/bare calls を拾う。AST parser 導入や observes / link 系は v00N で検討",
  "binary content(画像 / sound / 等)を Block 化したい場合: base64 inline か、別 sidecar か。現 spec は string のみ、binary は scope 外",
  "merge 時の hash chain rebase: 2 branch で同 file を別々に commit した後の merge logic は現 spec 外、別 doc で",
  "schemaVersion 2 で何を入れるか: signature / encryption / multi-author 履歴 等は将来検討",
  "runtime version の番号体系: 現案は zero-padded sequential('001', '002')。semver(1.0.0)に変更する余地、後日決定",
  "runtime upgrade 時の schema migration の書き方: yume_v002.js が v001 → v002 migration logic を持つか、別 migration file を持つか",
  "notes 自体の history(誰がいつ何を edit したか): v001 は最新のみ、v002 で git notes と同じく独立 history を検討",
  "notes multi-namespace: 現案は kind フィールドで識別、必要なら __block.notes_review / __block.notes_ai_reasoning 等に layer 分割を検討",
  "notes search の index: notesSearch を毎回 grep で実装するか、folder 内 index file を作るか(現 spec では grep で十分)",
  "runtime 自身の self-yume 化: handle file が自分も __block / versions を持ち自己 commit するか(完全 recursion)。chicken-and-egg の bootstrap 問題があるため v001 では plain JS module、v00N で再評価",
  "role taxonomy 拡張: handle / aiDoc / fn / module / doc / constraint / observation 以外の標準 role 追加(test / config / state / 等)を v00N で検討",
  "runtime.name = 'yume' 固定の必要性: 現状 field として required だが、将来複数互換 runtime が出るまで意味薄。v00N で optional 化検討",
  "type enum の明示: 現状 'fn' | 'class' | 'module' | 'doc' | ... と例示のみ、role taxonomy と同期させて canonical enum を spec 化するか検討",
];

// ============================================================
// 自己実行(node AiRunAndRead_BLOCKFILE.js)
// ============================================================
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("=== .yume.js Spec v" + VERSION + " (" + DATE + ") ===");
  console.log("status: " + STATUS);
  console.log();
  console.log("--- Purpose ---");
  console.log(Purpose.oneLine);
  console.log("primary mechanism: " + Purpose.primaryMechanism);
  console.log("  defense:    " + Purpose.defenseSide.label + " — " + Purpose.defenseSide.claim);
  console.log("  offense:    " + Purpose.offenseSide.label + " — " + Purpose.offenseSide.claim);
  console.log();
  console.log("--- Sections ---");
  const sections = [
    "§0 Purpose (defense + offense)",
    "§1 Header (.yume.js + // @yume-format: 1)",
    "§2 Schema (__block fields, notes layer)",
    "§2.5 Role Taxonomy (<name>.<role>.yume.js 命名規約)",
    "§3 Version (versions[] entry, no message field)",
    "§3.5 Note (mutable commentary, git-notes 相当)",
    "§4 Runtime (multi-version coexistence, convention-based resolution)",
    "§5 Head (HEAD region)",
    "§6 Boot (optional self-invocation)",
    "§7 Durability (2-layer guarantee)",
    "§8 Folder (yume/ver*.handle.yume.js layout)",
    "§9 Lifecycle (default codec flow + boundary commitManual)",
    "§10 Concurrency (atomic write + lock)",
    "§11 Git (granularity relation)",
    "§12 Taboos",
    "§13 MinimalExample",
    "§14 RuntimeApiSurface",
    "§15 YumeEvolutionModel",
    "§16 CodecModel (.yume.js = 圧縮形式、AI 経由で自動 version up)",
    "§17 OpenQuestions",
  ];
  sections.forEach(s => console.log("  " + s));
  console.log();
  console.log("read via:");
  console.log("  import { Schema, Header, Head, Boot, Runtime, Folder, YumeEvolutionModel, CodecModel, ... } from './AiRunAndRead_BLOCKFILE.js'");
}
