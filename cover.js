// cover.js — Phase 2.0 spec coverage
//
// Runs every case in runtime.spec.yume.js against a Proxy-wrapped runtime,
// records which runtime exports were actually called, and reports:
//   1. case pass/fail (must match `node runtime.spec.yume.js`)
//   2. declared-fn coverage: every case carries `fn`. Did the named fn
//      actually get invoked when run() executed? Catches case/fn drift.
//   3. runtime-export coverage: which runtime exports are touched by any
//      spec case at all. Highlights gaps in the spec table itself.
//
// Phase 2.0 only observes the spec runner. Phase 2.1 will extend the same
// hook to e2e.js so we can answer "did e2e exercise every spec case?".
// runtime is not modified; the hook lives entirely inside this file.

import { cases } from './runtime.spec.yume.js';

const realRt = await import('./runtimes/ver001.handle.yume.js');

const callsByCase = new Map();
let currentCase = null;

const hookedRt = new Proxy(realRt, {
  get(target, prop, receiver) {
    const v = Reflect.get(target, prop, receiver);
    if (typeof v !== 'function') return v;
    return function (...args) {
      if (currentCase) {
        if (!callsByCase.has(currentCase)) callsByCase.set(currentCase, new Set());
        callsByCase.get(currentCase).add(prop);
      }
      return v.apply(this, args);
    };
  },
});

let pass = 0;
let fail = 0;
const failTags = [];

for (const c of cases) {
  currentCase = c.tag;
  try {
    const ok = await c.run(hookedRt);
    if (ok) pass++;
    else { fail++; failTags.push(c.tag); }
  } catch (e) {
    fail++;
    failTags.push(c.tag + ' ERROR: ' + e.message);
  }
}
currentCase = null;

console.log(`spec: ${pass}/${cases.length} pass`);
if (failTags.length) {
  console.log('  failing:');
  for (const t of failTags) console.log('    ' + t);
}

const callsAll = new Set();
for (const set of callsByCase.values()) for (const n of set) callsAll.add(n);

const declaredFns = [...new Set(cases.map(c => c.fn).filter(Boolean))].sort();
const driftCases = cases.filter(c => c.fn && !(callsByCase.get(c.tag)?.has(c.fn)));
console.log(`declared-fn drift: ${driftCases.length}/${cases.length} cases declare an fn that was never called inside run()`);
if (driftCases.length) {
  for (const c of driftCases) {
    const actual = [...(callsByCase.get(c.tag) ?? [])].join(',') || '(none)';
    console.log(`    ${c.tag}  declared=${c.fn}  actual={${actual}}`);
  }
}

const exportedFns = Object.keys(realRt).filter(k => typeof realRt[k] === 'function').sort();
const touched = exportedFns.filter(f => callsAll.has(f));
const untouched = exportedFns.filter(f => !callsAll.has(f));
console.log(`runtime-export coverage: ${touched.length}/${exportedFns.length} touched by spec`);
if (untouched.length) {
  console.log('  not touched by any spec case:');
  for (const f of untouched) console.log('    ' + f);
}

if (fail > 0) process.exit(1);
