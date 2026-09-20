---
name: dev-tools
description: Entry point for Node.js API development — loads node-spine + clean-code and shows the dev workflow. INVOKE when starting a new feature, resource, or module.
---

# dev-tools — Node.js API Developer Workflow

When this skill is invoked:

1. Invoke the `node-spine` skill (structural coding standard — always active).
2. Invoke the `clean-code` skill (design principles bible — always active).
3. Read `.claude/skills/dev-tools/README.md`.
4. Display its full contents to the developer — verbatim, no additions, no summary.

All three steps are required. Do not skip the paired skills. Do not generate a dynamic workflow. The README is the single source of truth for the workflow.
