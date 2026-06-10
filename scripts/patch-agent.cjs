#!/usr/bin/env node
// scripts/patch-agent.cjs
// Updated for pi-mono 0.64 (anchor: subscribe method)
// Added: post-injection smoke test (Guard)
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ELYNYX = path.join(
  os.homedir(),
  '.nvm/versions/node/v22.22.1/lib/node_modules/elynx'
);
const AGENT_JS = path.join(
  ELYNYX,
  'node_modules/@elynyx/agent-core/dist/agent.js'
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
  // Still run smoke test to confirm they work
  runSmokeTest();
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
  runSmokeTest();
  process.exit(0);
}

// idempotency check
const anchorPos = src.indexOf(ANCHOR);
const afterAnchor = src.substring(anchorPos + ANCHOR.length, anchorPos + ANCHOR.length + 300);
if (afterAnchor.includes('setSystemPrompt') || afterAnchor.includes('replaceMessages')) {
  console.log('[patch-agent] Anchor already has patch content, skipping.');
  runSmokeTest();
  process.exit(0);
}

const INJECT = parts.join('\n');
const patched = src.replace(ANCHOR, ANCHOR + '\n' + INJECT);
fs.writeFileSync(AGENT_JS, patched, 'utf8');
console.log('[patch-agent] Patch applied.');
if (hasCleanSetSystemPrompt === false) console.log('[patch-agent]   + setSystemPrompt');
if (hasCleanReplaceMessages === false) console.log('[patch-agent]   + replaceMessages');

// Step 4: Smoke test — verify the patched file is valid
runSmokeTest();

function runSmokeTest() {
  console.log('[patch-agent] Running smoke test...');
  
  // Test 1: Syntax check
  try {
    require('node:child_process').execSync(
      `node -c "${AGENT_JS}"`,
      { stdio: 'pipe' }
    );
    console.log('[patch-agent]   ✓ Syntax valid');
  } catch (e) {
    console.error('[patch-agent]   ✗ SYNTAX ERROR in agent.js!');
    console.error('[patch-agent]   This is a critical failure (Pitfall #22b).');
    process.exit(1);
  }
  
  // Test 2: Verify methods exist in source text
  const finalSrc = fs.readFileSync(AGENT_JS, 'utf8');
  const hasSSP = /setSystemPrompt\s*\(/.test(finalSrc);
  const hasRM = /replaceMessages\s*\(/.test(finalSrc);
  
  if (!hasSSP) {
    console.error('[patch-agent]   ✗ setSystemPrompt NOT FOUND after patch!');
    process.exit(1);
  }
  if (!hasRM) {
    console.error('[patch-agent]   ✗ replaceMessages NOT FOUND after patch!');
    process.exit(1);
  }
  
  console.log('[patch-agent]   ✓ setSystemPrompt present');
  console.log('[patch-agent]   ✓ replaceMessages present');
  console.log('[patch-agent] Smoke test passed.');
}
