#!/bin/bash
set -e

OPENCLAW="$HOME/.nvm/versions/node/v22.22.1/lib/node_modules/elysiaclaw"
NM="$OPENCLAW/node_modules/@mariozechner"
AGENT_JS="$NM/pi-agent-core/dist/agent.js"

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

echo ""
echo "=== Step 1: Build ==="
cd ~/pi-mono
npm run build

echo ""
echo "=== Step 2: Deploy pi-agent-core (0.64) ==="
rm -rf "$NM/pi-agent-core/dist" && cp -r ~/pi-mono/packages/agent/dist "$NM/pi-agent-core/dist"
echo "[OK] pi-agent-core deployed"

echo ""
echo "=== Step 3: Deploy pi-ai (0.64) ==="
rm -rf "$NM/pi-ai/dist" && cp -r ~/pi-mono/packages/ai/dist "$NM/pi-ai/dist"
echo "[OK] pi-ai deployed"

echo ""
echo "=== Step 4: Deploy pi-tui (0.64) ==="
rm -rf "$NM/pi-tui/dist" && cp -r ~/pi-mono/packages/tui/dist "$NM/pi-tui/dist"
echo "[OK] pi-tui deployed"

echo ""
echo "=== Step 5: Deploy pi-coding-agent (0.64) ==="
rm -rf "$NM/pi-coding-agent/dist" && cp -r ~/pi-mono/packages/coding-agent/dist "$NM/pi-coding-agent/dist"
echo "[OK] pi-coding-agent deployed"

echo ""
echo "=== Step 6: Re-apply agent.js patch (0.64 anchor) ==="
node ~/pi-mono/scripts/patch-agent.cjs

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

echo ""
echo "=== Step 7: Sync postinstall script ==="
cp ~/pi-mono/scripts/patch-agent.cjs "$OPENCLAW/scripts-patch/patch-agent.cjs"
echo "[OK] postinstall script synced"

# ── Post-deploy Guard 3: Tool registration parity ──
echo ""
echo "[Guard 3] Checking tool registration parity..."
TOOLS_SRC="$HOME/pi-mono/packages/coding-agent/src/core/tools/index.ts"
MASTER_SRC="$HOME/pi-mono/packages/coding-agent/src/index.ts"
if [ -f "$TOOLS_SRC" ] && [ -f "$MASTER_SRC" ]; then
    # Count tools in allTools object (lines with colon before the closing brace)
    TOOLS_COUNT=$(grep -A999 "^export const allTools" "$TOOLS_SRC" | sed '/^};$/q' | grep -c "Tool," || echo 0)
    # Count tool-related exports in master index
    MASTER_EXPORTS=$(grep -c "ToolDefinition\|toolDefinition" "$MASTER_SRC" || echo 0)
    echo "  allTools entries: ~$TOOLS_COUNT"
    echo "  Master index tool exports: ~$MASTER_EXPORTS"
    if [ "$TOOLS_COUNT" -gt 0 ]; then
        echo "  Tool parity ... reported (manual review recommended)"
    fi
fi

echo ""
echo "=== Step 8: Restart gateway ==="
~/.nvm/versions/node/v22.22.1/bin/elysiaclaw gateway restart
echo "[OK] Gateway restarted"

echo ""
echo "=== Step 9: Verify ==="
sleep 2
~/.nvm/versions/node/v22.22.1/bin/elysiaclaw status
echo ""
echo "==========================================="
echo "  Deploy complete. Test via Telegram."
echo "==========================================="