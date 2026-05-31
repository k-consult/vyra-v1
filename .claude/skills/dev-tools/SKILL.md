---
name: dev-tools
description: Parent skill — entry point for Node.js API development. Loads node-spine and clean-code, then displays the developer workflow from README.md. INVOKE when the user runs `/dev-tools` or asks where to start on a new feature, resource, or module.
---

# dev-tools — Node.js API Developer Workflow

When this skill is invoked:

1. Invoke the `node-spine` skill (structural coding standard — always active).
2. Invoke the `clean-code` skill (design principles bible — always active).
3. Read `.claude/skills/dev-tools/README.md`.
4. Display its full contents to the developer — verbatim, no additions, no summary.

All three steps are required. Do not skip the paired skills. Do not generate a dynamic workflow. The README is the single source of truth for the workflow.
