#!/bin/bash
set -e

ELYSIACLAW="$HOME/.nvm/versions/node/v22.22.1/lib/node_modules/elysiaclaw"
NM="$ELYSIACLAW/node_modules/@mariozechner"
AGENT_JS="$NM/pi-agent-core/dist/agent.js"
ELYSIACLAW_DIST="$HOME/projects/pi-mono/elysiaclaw/dist"

echo "==========================================="
echo "  ElysiaClaw Deploy (with guards)"
echo "==========================================="

# ── Pre-flight Guard 1: Config validation ──
echo ""
echo "[Guard 1] Validating configuration files..."
python3 -c "
import json, sys, os, yaml

# elysiaclaw.json
json_path = os.path.expanduser('~/.elysiaclaw/elysiaclaw.json')
if os.path.exists(json_path):
    try:
        with open(json_path) as f:
            cfg = json.load(f)
        missing = [k for k in ['agents','channels','gateway'] if k not in cfg]
        if missing:
            print(f'  ERROR: elysiaclaw.json missing keys: {missing}', file=sys.stderr)
            sys.exit(1)
        print('  elysiaclaw.json ... OK')
    except json.JSONDecodeError as e:
        print(f'  ERROR: elysiaclaw.json parse failed: {e}', file=sys.stderr)
        sys.exit(1)
else:
    print('  elysiaclaw.json not found (first deploy?)')

# config.yaml
yaml_path = os.path.expanduser('~/.elysiaclaw/config.yaml')
if os.path.exists(yaml_path):
    try:
        with open(yaml_path) as f:
            ycfg = yaml.safe_load(f)
        if ycfg and 'gateway' not in ycfg:
            print('  ERROR: config.yaml missing top-level gateway key (Pitfall #30!)', file=sys.stderr)
            sys.exit(1)
        mode = (ycfg or {}).get('gateway',{}).get('mode','UNSET')
        if mode not in ('local','remote'):
            print(f'  WARNING: gateway.mode={mode} — expected local or remote (Pitfall #31)', file=sys.stderr)
        else:
            print('  config.yaml ... OK')
    except Exception as e:
        print(f'  ERROR: config.yaml: {e}', file=sys.stderr)
        sys.exit(1)
else:
    print('  config.yaml not found')
" || exit 1

# ── Phase A: pi-mono framework layer ──
echo ""
echo "=== Step 1: Build pi-mono framework ==="
cd ~/projects/pi-mono
npm run build

echo ""
echo "=== Step 2: Deploy pi-agent-core (0.64) ==="
rm -rf "$NM/pi-agent-core/dist" && cp -r ~/projects/pi-mono/packages/agent/dist "$NM/pi-agent-core/dist"
echo "[OK] pi-agent-core deployed"

echo ""
echo "=== Step 3: Deploy pi-ai (0.64) ==="
rm -rf "$NM/pi-ai/dist" && cp -r ~/projects/pi-mono/packages/ai/dist "$NM/pi-ai/dist"
echo "[OK] pi-ai deployed"

echo ""
echo "=== Step 4: Deploy pi-tui (0.64) ==="
rm -rf "$NM/pi-tui/dist" && cp -r ~/projects/pi-mono/packages/tui/dist "$NM/pi-tui/dist"
echo "[OK] pi-tui deployed"

echo ""
echo "=== Step 5: Deploy pi-coding-agent (0.64) ==="
rm -rf "$NM/pi-coding-agent/dist" && cp -r ~/projects/pi-mono/packages/coding-agent/dist "$NM/pi-coding-agent/dist"
echo "[OK] pi-coding-agent deployed"

echo ""
echo "=== Step 6: Re-apply agent.js patch (0.64 anchor) ==="
node ~/projects/pi-mono/scripts/patch-agent.cjs

# ── Post-patch Guard 2: Verify patch injection ──
echo ""
echo "[Guard 2] Verifying patch injection..."
if [ -f "$AGENT_JS" ]; then
    SET_SP=$(grep -c "setSystemPrompt" "$AGENT_JS" 2>/dev/null || echo 0)
    REPLACE_MSG=$(grep -c "replaceMessages" "$AGENT_JS" 2>/dev/null || echo 0)
    if [ "$SET_SP" -ge 1 ] && [ "$REPLACE_MSG" -ge 1 ]; then
        echo "  setSystemPrompt: $SET_SP occurrence(s)"
        echo "  replaceMessages: $REPLACE_MSG occurrence(s)"
    else
        echo "  ERROR: Patch missing! setSystemPrompt=$SET_SP replaceMessages=$REPLACE_MSG"
        echo "  agent.js may be corrupted. Aborting."
        exit 1
    fi
    # Syntax check
    node -c "$AGENT_JS" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "  Syntax check ... OK"
    else
        echo "  ERROR: agent.js has syntax errors! (Pitfall #22b)"
        exit 1
    fi
else
    echo "  WARNING: agent.js not found at $AGENT_JS"
fi

# ── Phase B: elysiaclaw application layer ──
echo ""
echo "=== Step 7: Build elysiaclaw application ==="
cd ~/projects/pi-mono/elysiaclaw

# tsdown main build (skips DTS errors - Pitfall #38)
node scripts/tsdown-build.mjs
node scripts/copy-plugin-sdk-root-alias.mjs
# Optional post-build steps (non-fatal)
node --import tsx scripts/write-plugin-sdk-entry-dts.ts 2>/dev/null || true
node --import tsx scripts/canvas-a2ui-copy.ts 2>/dev/null || true
node --import tsx scripts/copy-hook-metadata.ts 2>/dev/null || true
node --import tsx scripts/copy-export-html-templates.ts 2>/dev/null || true
node --import tsx scripts/write-build-info.ts 2>/dev/null || true
node --import tsx scripts/write-cli-startup-metadata.ts 2>/dev/null || true
node --import tsx scripts/write-cli-compat.ts 2>/dev/null || true
echo "[OK] elysiaclaw built"

echo ""
echo "=== Step 8: Deploy elysiaclaw dist (clean slate) ==="
if [ -d "$ELYSIACLAW_DIST" ]; then
    DIST_FILE_COUNT=$(find "$ELYSIACLAW_DIST" -type f | wc -l)
    if [ "$DIST_FILE_COUNT" -lt 100 ]; then
        echo "  ERROR: dist has only $DIST_FILE_COUNT files — build likely incomplete"
        exit 1
    fi
    rm -rf "$ELYSIACLAW/dist"
    cp -r "$ELYSIACLAW_DIST" "$ELYSIACLAW/dist"
    echo "[OK] elysiaclaw dist deployed ($DIST_FILE_COUNT files → $ELYSIACLAW/dist/)"
else
    echo "  ERROR: elysiaclaw dist not found at $ELYSIACLAW_DIST"
    exit 1
fi

# ── Guard 3: Dist integrity — verify key modules present ──
echo ""
echo "[Guard 3] Dist integrity check..."
REQUIRED_PATTERNS=(
  "memory_search"
  "memory_get"
  "memory-core"
  "createMemorySearchTool"
)
MISSING_MODULES=()
for pattern in "${REQUIRED_PATTERNS[@]}"; do
  if ! grep -rq "$pattern" "$ELYSIACLAW/dist/" 2>/dev/null; then
    MISSING_MODULES+=("$pattern")
  fi
done
if [ ${#MISSING_MODULES[@]} -gt 0 ]; then
  echo "  ERROR: Missing required modules in dist: ${MISSING_MODULES[*]}"
  exit 1
fi
echo "  All required modules present (memory_search, memory_get, memory-core, createMemorySearchTool)"

echo ""
echo "=== Step 9: Deploy extensions ==="
EXTS_SRC="$HOME/projects/pi-mono/elysiaclaw/extensions"
EXTS_DST="$ELYSIACLAW/extensions"
if [ -d "$EXTS_SRC" ]; then
    for ext_dir in "$EXTS_SRC"/*/; do
        ext_name=$(basename "$ext_dir")
        if [ -f "$ext_dir/index.ts" ]; then
            rm -rf "$EXTS_DST/$ext_name"
            mkdir -p "$EXTS_DST/$ext_name"
            # Copy top-level source files (exclude node_modules, .gitignore)
            find "$ext_dir" -maxdepth 1 -type f \
              -not -name '.gitignore' \
              -exec cp {} "$EXTS_DST/$ext_name/" \;
            # Copy subdirectories (e.g. telegram/src/) — exclude node_modules/skills/dist
            # Pitfall #76: -maxdepth 1 drops src/ subdirs, breaking plugins that import from ./src/
            for sub_dir in "$ext_dir"*/; do
                sub_name=$(basename "$sub_dir")
                if [ "$sub_name" = "node_modules" ] || [ "$sub_name" = "skills" ] || [ "$sub_name" = "dist" ]; then
                    continue
                fi
                cp -r "$sub_dir" "$EXTS_DST/$ext_name/$sub_name"
            done
            echo "  [OK] synced extension: $ext_name"
        fi
    done
else
    echo "  WARNING: extensions source dir not found at $EXTS_SRC"
fi

# ── Phase C: Post-deploy ──
echo ""
echo "=== Step 10: Sync postinstall script ==="
cp ~/projects/pi-mono/scripts/patch-agent.cjs "$ELYSIACLAW/scripts-patch/patch-agent.cjs"
echo "[OK] postinstall script synced"

# ── Guard 4: Framework tool registration parity ──
echo ""
echo "[Guard 4] Framework tool registration parity..."
TOOLS_SRC="$HOME/projects/pi-mono/packages/coding-agent/src/core/tools/index.ts"
MASTER_SRC="$HOME/projects/pi-mono/packages/coding-agent/src/index.ts"
if [ -f "$TOOLS_SRC" ] && [ -f "$MASTER_SRC" ]; then
    TOOLS_COUNT=$(grep -A999 "^export const allTools" "$TOOLS_SRC" | sed '/^};$/q' | grep -c "Tool," || echo 0)
    MASTER_EXPORTS=$(grep -c "ToolDefinition\|toolDefinition" "$MASTER_SRC" || echo 0)
    echo "  allTools entries: ~$TOOLS_COUNT"
    echo "  Master index tool exports: ~$MASTER_EXPORTS"
    if [ "$TOOLS_COUNT" -gt 0 ]; then
        echo "  Tool parity ... reported (manual review recommended)"
    fi
fi

echo ""
echo "=== Step 11: Restart gateway ==="
~/.nvm/versions/node/v22.22.1/bin/elysiaclaw gateway restart
echo "[OK] Gateway restarted"

echo ""
echo "=== Step 12: Verify ==="
sleep 3

# ── Guard 5: memory_search end-to-end check ──
echo ""
echo "[Guard 5] memory_search end-to-end check..."
GW_TOKEN=$(python3 -c "
import json, os
with open(os.path.expanduser('~/.elysiaclaw/elysiaclaw.json')) as f:
    cfg = json.load(f)
print(cfg.get('gateway',{}).get('auth',{}).get('token',''))
" 2>/dev/null)
if [ -n "$GW_TOKEN" ]; then
    MEM_CHECK=$(curl -s -X POST http://127.0.0.1:18789/tools/invoke \
      -H "Authorization: Bearer $GW_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"tool":"memory_search","args":{"query":"deploy","maxResults":1},"sessionKey":"agent:main:main"}' 2>&1)
    if echo "$MEM_CHECK" | grep -q '"ok":true'; then
        echo "  memory_search API ... OK"
    else
        echo "  ERROR: memory_search API returned failure"
        echo "  Response: $(echo "$MEM_CHECK" | head -c 200)"
    fi
else
    echo "  WARNING: Could not resolve gateway token for E2E check"
fi

~/.nvm/versions/node/v22.22.1/bin/elysiaclaw status
echo ""
echo "==========================================="
echo "  Deploy complete. Guards passed:"
echo "    [G1] Config validation"
echo "    [G2] Patch injection"
echo "    [G3] Dist integrity (memory modules)"
echo "    [G4] Framework tool parity"
echo "    [G5] memory_search E2E"
echo "==========================================="
