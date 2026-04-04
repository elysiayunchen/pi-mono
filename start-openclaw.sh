#!/bin/bash
# Load API keys from openclaw's .env
set -a
source ~/.openclaw/.env
set +a

# Run from pi-mono source
cd ~/pi-mono/packages/coding-agent
node dist/cli.js "$@"
