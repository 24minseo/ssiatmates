import "./check-ir-library.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import ts from "typescript";
const dir = path.resolve("node_modules/.cache/ir-library-tests");
let source = await fs.readFile("src/components/ir-deck/useDeckLibrary.ts", "utf8");
source = source.replace('import { useEffect, useRef, useState } from "react";', 'const {useEffect,useRef,useState}=globalThis.__libraryTest.react;')
  .replace('import { libraryRpc } from "./library-client";', 'const libraryRpc=(...args)=>globalThis.__libraryTest.rpc(...args);');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replaceAll('"./library"', '"./library.mjs"');
await fs.writeFile(path.join(dir, "useDeckLibrary.mjs"), code);
let slots = [], cursor = 0, effects = [], rpc, hook;
const listeners = new Map();
const oldWindow = globalThis.window;
globalThis.window = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
globalThis.__libraryTest = { rpc: (...args) => rpc(...args), react: {
  useRef: initial => { const i = cursor++; return slots[i] ??= { current: initial }; },
  useState: initial => { const i = cursor++; if (slots[i] === undefined) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
  useEffect: (fn, deps) => { const i = cursor++, old = slots[i]; if (!old || JSON.stringify(old.deps) !== JSON.stringify(deps)) { old?.cleanup?.(); slots[i] = { deps }; effects.push(() => { slots[i].cleanup = fn(); }); } },
} };
const { useDeckLibrary } = await import(pathToFileURL(path.join(dir, "useDeckLibrary.mjs")).href);
const one = "11111111-1111-4111-8111-111111111111", two = "22222222-2222-4222-8222-222222222222", deck = "33333333-3333-4333-8333-333333333333";
const row = { deck_id: deck, title: "덱", created_at: "2026-11-21T00:00:00Z", updated_at: "2026-11-21T00:00:00Z" };
const response = owner => ({ owner_id: owner, items: [row], next_cursor: null });
const render = (owner, enabled = true) => { cursor = 0; hook = useDeckLibrary(owner, enabled); for (const fn of effects.splice(0)) fn(); };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
let releaseOld;
rpc = () => new Promise(resolve => { releaseOld = resolve; });
render(one); assert.equal(hook.items.length, 0);
rpc = async () => response(two); render(two); await tick(); render(two);
assert.equal(hook.items.length, 1);
releaseOld(response(one)); await tick(); render(two); assert.equal(hook.ready, true); assert.equal(hook.items.length, 1);
let releaseStale;
rpc = () => new Promise(resolve => { releaseStale = resolve; });
void listeners.get("focus")();
hook.remove(deck);
rpc = async () => ({ owner_id: two, items: [], next_cursor: null });
render(two); await tick(); render(two); assert.equal(hook.items.length, 0);
releaseStale(response(two)); await tick(); render(two); assert.equal(hook.items.length, 0);
render(undefined, false); assert.equal(hook.items.length, 0); assert.equal(hook.ready, false);
for (const slot of slots) slot?.cleanup?.();
globalThis.window = oldWindow; delete globalThis.__libraryTest;
console.log("PASS delayed prior-account responses ignored; deleted decks not resurrected by stale list responses; sign-out hides the previous account library; focus refresh uses server reads only.");
