#!/usr/bin/env bash
# PostToolUse hook: typecheck the touched workspace after Write/Edit on a .ts/.tsx file.
# Monorepo-aware: each of lib/cli/agents/api/ui has its own tsconfig.json, so this
# resolves the workspace from the edited file's path and runs `tsc --noEmit` from
# inside it (npm workspaces hoist `tsc` to the repo-root node_modules; npx resolves
# it fine from any workspace dir). Non-blocking: always exits 0. On failure, surfaces
# the tsc output back to Claude via additionalContext instead of just failing silently.

f=$(python3 -c "
import sys, json
d = sys.stdin.read()
j = json.loads(d) if d.strip() else {}
print((j.get('tool_input') or {}).get('file_path', ''))
")

[[ "$f" =~ \.(tsx?)$ ]] || exit 0

repo=/Users/krishnan/_ks/work/projects/vyra-v1
case "$f" in
  "$repo"/lib/*)    ws=lib ;;
  "$repo"/cli/*)    ws=cli ;;
  "$repo"/agents/*) ws=agents ;;
  "$repo"/api/*)    ws=api ;;
  "$repo"/ui/*)     ws=ui ;;
  *) exit 0 ;;
esac

[[ -f "$repo/$ws/tsconfig.json" ]] || exit 0

out=$(cd "$repo/$ws" && npx tsc --noEmit 2>&1)
status=$?

if [[ $status -ne 0 ]]; then
  msg=$(printf 'tsc --noEmit failed in %s/ after editing %s:\n%s' "$ws" "$f" "$out" | head -c 4000)
  jq -n --arg msg "$msg" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$msg}}'
fi

exit 0
