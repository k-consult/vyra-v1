# GA API Developer Workflow

## The Four Skills

Two skills are **always active** (fire automatically on every code change). Two are **on-demand** (you invoke them explicitly).

| Skill | Trigger | What it does |
|---|---|---|
| `code-spine` | Always active — every file write | Enforces module structure: edge → core → factory + spec + repo. Flags violations inline as you code. |
| `clean-code` | Always active — every design decision | The design principles behind the rules: layers, contracts, naming, patterns. When you're unsure *why* a rule exists, this is the answer. |
| `code-gen` | On demand — `/code-gen ...` | Scaffolds a full resource from a spec file. Generates all files, wires the router, and runs the API client. |
| `code-audit` | On demand — `/code-audit ...` | Runs 12 structural checks. No violations = ready to merge. Always run before a PR. |

---

## New Module Development

```
1. Scaffold the skeleton
   /code-gen <resource> <new-module>
   → creates app/module/<new-module>/ with full folder structure + empty spec templates

2. Fill in the module spec
   app/module/<new-module>/.design/MODULE.md

3. Write the resource spec
   app/module/<new-module>/.design/<resource>.md
   → six sections: meta · entity · rules · routes · persistence · providers (optional)

4. Scaffold the resource
   /code-gen <resource> <new-module>
   → generates factory.js · spec.js · repo.js · core/index.js
                router.js · handlers · Bruno collection
   → wires the master router · runs sync.js + client.js

5. Fill in the logic
   Edit the generated files. code-spine is active — violations flagged inline.

6. Audit before PR
   /code-audit <new-module>
   Fix all violations before merging.
```

---

## Existing Module Updates

### Adding a new resource

```
1. Write the spec     app/module/<module>/.design/<resource>.md
2. Scaffold           /code-gen <resource> <module>
3. Fill in the logic  edit factory.js · spec.js · repo.js · core/index.js
4. Audit              /code-audit <module>
```

### Editing existing code

```
1. Make your changes  — code-spine is active, violations are flagged inline
2. Audit before PR    /code-audit <module> <resource>
```

### Refresh API client only (routes.txt + Bruno collections)

```
/code-gen api-client <module>
```

---

## Quick Reference

| Command | When to use |
|---|---|
| `/code-gen <resource> <module>` | Add a new resource to a module |
| `/code-gen api-client <module>` | Regenerate routes.txt + Bruno collections |
| `/code-audit <module>` | Pre-PR gate — full module |
| `/code-audit <module> <resource>` | Pre-PR gate — single resource |
| `/clean-code` | Design question — load the design bible |
