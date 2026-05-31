#!/usr/bin/env bash
# PostToolUse hook: run eslint --fix on .ts/.tsx files after Write/Edit.
# Non-blocking: always exits 0. Safe to run before eslint is installed.

f=$(python3 -c "
import sys, json
d = sys.stdin.read()
j = json.loads(d) if d.strip() else {}
print((j.get('tool_input') or {}).get('file_path', ''))
")

[[ "$f" =~ \.(tsx?)$ ]] && npx eslint --fix "$f" 2>/dev/null

exit 0
