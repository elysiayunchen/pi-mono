#!/usr/bin/env node
// scripts/patch-agent.cjs
// Updated for pi-mono 0.64 (anchor: subscribe method)
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const OPENCLAW = path.join(
  os.homedir(),
  '.nvm/versions/node/v22.22.1/lib/node_modules/elysiaclaw'
);
const AGENT_JS = path.join(
  OPENCLAW,
  'node_modules/@mariozechner/pi-agent-core/dist/agent.js'
);

if (fs.existsSync(AGENT_JS) === false) {
  console.error('[patch-agent] NOT FOUND:', AGENT_JS);
  process.exit(1);
}

let src = fs.readFileSync(AGENT_JS, 'utf8');

// Step 0: clean corrupted code
src = src.replace(/^\s*\/\/\s*REMOVED_.*$/gm, '');
const REMOVED_BLOCK = /(?:\/\/\s*REMOVED_\s*)+setSystemPrompt\(v\)\s*\{[\s\S]*?\n\s*\}\s*\n?/g;
if (REMOVED_BLOCK.test(src)) {
  src = src.replace(REMOVED_BLOCK, '');
  console.log('[patch-agent] Cleaned corrupted REMOVED_ block.');
}

// Step 1: detect existing methods
const hasCleanSetSystemPrompt = /\n\s{4}setSystemPrompt\(v\)\s*\{/.test(src);
const hasCleanReplaceMessages = /\n\s{4}replaceMessages\(ms\)\s*\{/.test(src);

if (hasCleanSetSystemPrompt && hasCleanReplaceMessages) {
  console.log('[patch-agent] Both methods exist, nothing to do.');
  process.exit(0);
}

// Step 2: anchor — subscribe method (0.64 stable)
const ANCHOR = [
  '    subscribe(listener) {',
  '        this.listeners.add(listener);',
  '        return () => this.listeners.delete(listener);',
  '    }'
].join('\n');

if (src.includes(ANCHOR) === false) {
  console.error('[patch-agent] ERROR: subscribe anchor not found.');
  process.exit(1);
}

// Step 3: inject missing methods
const parts = [];
if (hasCleanSetSystemPrompt === false) {
  parts.push(
    '    // [patch] setSystemPrompt required by pi-coding-agent 0.64',
    '    setSystemPrompt(v) {',
    '        this._state.systemPrompt = v;',
    '    }'
  );
}
if (hasCleanReplaceMessages === false) {
  parts.push(
    '    // [patch] replaceMessages required by pi-coding-agent 0.64',
    '    replaceMessages(ms) {',
    '        this._state.messages = ms.slice();',
    '    }'
  );
}

if (parts.length === 0) {
  console.log('[patch-agent] Nothing to inject.');
  process.exit(0);
}

// idempotency check
const anchorPos = src.indexOf(ANCHOR);
const afterAnchor = src.substring(anchorPos + ANCHOR.length, anchorPos + ANCHOR.length + 300);
if (afterAnchor.includes('setSystemPrompt') || afterAnchor.includes('replaceMessages')) {
  console.log('[patch-agent] Anchor already has patch content, skipping.');
  process.exit(0);
}

const INJECT = parts.join('\n');
const patched = src.replace(ANCHOR, ANCHOR + '\n' + INJECT);
fs.writeFileSync(AGENT_JS, patched, 'utf8');
console.log('[patch-agent] Patch applied.');
if (hasCleanSetSystemPrompt === false) console.log('[patch-agent]   + setSystemPrompt');
if (hasCleanReplaceMessages === false) console.log('[patch-agent]   + replaceMessages');
