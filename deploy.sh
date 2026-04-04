#!/bin/bash
set -e

OPENCLAW="$HOME/.nvm/versions/node/v22.22.1/lib/node_modules/elysiaclaw"
NM="$OPENCLAW/node_modules/@mariozechner"

echo "=== Step 1: Build ==="
cd ~/pi-mono
npm run build

echo ""
echo "=== Step 2: Deploy pi-agent-core (0.58 -> 0.64) ==="
rm -rf "$NM/pi-agent-core/dist" && cp -r ~/pi-mono/packages/agent/dist "$NM/pi-agent-core/dist"
echo "[OK] pi-agent-core deployed"

echo ""
echo "=== Step 3: Deploy pi-ai (0.58 -> 0.64) ==="
rm -rf "$NM/pi-ai/dist" && cp -r ~/pi-mono/packages/ai/dist "$NM/pi-ai/dist"
echo "[OK] pi-ai deployed"

echo ""
echo "=== Step 4: Deploy pi-tui (0.58 -> 0.64) ==="
rm -rf "$NM/pi-tui/dist" && cp -r ~/pi-mono/packages/tui/dist "$NM/pi-tui/dist"
echo "[OK] pi-tui deployed"

echo ""
echo "=== Step 5: Deploy pi-coding-agent ==="
rm -rf "$NM/pi-coding-agent/dist" && cp -r ~/pi-mono/packages/coding-agent/dist "$NM/pi-coding-agent/dist"
echo "[OK] pi-coding-agent deployed"

echo ""
echo "=== Step 6: Re-apply agent.js patch (0.64 anchor) ==="
node ~/pi-mono/scripts/patch-agent.cjs

echo ""
echo "=== Step 7: Sync postinstall script ==="
cp ~/pi-mono/scripts/patch-agent.cjs "$OPENCLAW/scripts-patch/patch-agent.cjs"
echo "[OK] postinstall script synced"

echo ""
echo "=== Step 8: Restart gateway ==="
~/.nvm/versions/node/v22.22.1/bin/elysiaclaw gateway restart
echo "[OK] Gateway restarted"

echo ""
echo "=== Step 9: Verify ==="
sleep 2
~/.nvm/versions/node/v22.22.1/bin/elysiaclaw status
echo ""
echo "=== Done! ==="
