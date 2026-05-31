---
name: clean-code
description: The Code-Craft Bible — definitive gate for every design and code review. 11 parts covering: layered architecture + Hexagonal/Ports&Adapters, contract-first design (TypeScript for greenfield), encapsulation, Tell-Don't-Ask, Law of Demeter, OCP + YAGNI, DRY, intention-revealing names, Ubiquitous Language + Bounded Contexts, fail-fast validation, operations (identity/soft-delete/greenfield), proactive pattern application, full GOF + Fowler catalog (★=live studio examples), micro-craft (function size/args/comments/error handling), complexity management (deep modules/strategic programming/package cohesion), distributed patterns (idempotency/CQRS/domain events/outbox). INVOKE before designing or reviewing any system component, module, interface, or pattern. Pairs with `node-spine` (structural coding rules).
---

# clean-code — The Code-Craft Bible

This skill is the definitive gate for design and code quality.
Each rule names what makes a design **unshippable**, and what the correct form looks like.
If a proposed design cannot satisfy every rule in the checklist at the end, redesign before writing code.

The rules are grouped into eleven concerns:

1. **Layers** — how to cut the system
2. **Contracts** — how to enforce the cuts
3. **Extension** — how to add without breaking
4. **Vocabulary** — how to name things correctly
5. **Validity** — how to fail fast and clearly
6. **Operations** — how to handle state and time
7. **Proactive Application** — how to spot and act on design smells
8. **Pattern Catalog** — GOF + Fowler reference (loaded into context; use it)
9. **Micro-Craft** — function size, arguments, comments, CQS, error handling
10. **Complexity Management** — essential vs accidental, deep modules, strategic programming, package principles
11. **Distributed & Event-Driven** — idempotency, CQRS, domain events, outbox

---

## Part 1 — Layers

### 1.1 Name your layers before writing any file

A layer is a named slice of the system with exactly one job, one allowed dependency direction, and one exposed boundary. Name them before writing a single file.

If you cannot name a layer's job in four words or fewer, the boundary is wrong.

**The canonical four-layer stack — applicable to any backend system:**

```
Presentation / Edge          receives external input; speaks the protocol (HTTP, CLI, queue)
Orchestration / Core         sequences the work; owns the workflow between domain units
Domain / Factory + Validator builds and validates entities; pure or near-pure
Persistence / Repo           reads and writes storage; speaks only the storage protocol
```

Dependencies flow **downward only**. Any upward arrow is a defect.

```
Presentation  →  Orchestration  →  Domain  →  Persistence
     ✓                ✓               ✓
 Persistence  →  Orchestration      ← DEFECT: upward arrow
```

**Studio example:**

```
edge/api/<resource>/router.js    HTTP surface only: unpack ctx, call core, set status
core/<entity>/index.js           Sequence: factory → spec → repo. Handles cross-entity flow.
core/<entity>/factory.js         Pure build: defaults, normalise, derive. Zero I/O.
core/<entity>/spec.js            Validation: is this entity allowed? Throws on failure.
core/<entity>/repo.js            Storage: queries only. No business rules.
```

The directory structure mirrors the layer structure. A cross-layer `require()` is immediately visible in any diff.

---

### 1.2 Define each layer by what it MUST NOT do

A layer's job is defined as much by its prohibitions as by its permissions. Write both.

| Layer | One job | MUST NOT |
|---|---|---|
| Presentation | Parse input, call orchestrator, emit response | Validate payload, access storage, contain business rules |
| Orchestrator | Sequence domain calls, enforce flow order | Execute queries, validate entities, import peer repos |
| Factory | Build and normalise entities | Access storage, log, throw errors, import network |
| Validator / Spec | Validate built entities against rules | Build entities, write to storage, call peer validators |
| Repo / Persistence | Read and write storage | Business rules, calling peer repos, throwing protocol errors |

If a layer does something in its "MUST NOT" column, move the code — don't argue about whether this particular instance is an exception.

---

### 1.3 Every layer boundary has an explicit contract

Layers don't call each other freely. Each boundary is defined by a contract:

- Lists every method by name
- Assigns a **throwing default** to each unimplemented method
- Lives in a dedicated file (`iX.js`, `interface.js`, `contract.js`)
- Is satisfied by implementing handlers via spread / merge

The contract file is the canonical documentation. A comment describing the interface is not a contract — it cannot enforce itself.

**Studio example — `iOp.js`:**

```js
const notImplemented = (verb) => async () => {
    throw new Error(`op.${verb} not implemented`);
};

module.exports = {
    name:     'unknown',
    resolve:  () => ({ resolved: false }),
    process:  () => { throw new Error('op.process not implemented'); },
    validate: notImplemented('validate'),
    execute:  notImplemented('execute'),
    compile:  () => { throw new Error('op.compile not implemented'); },
    expand:   notImplemented('expand'),
};
```

Any handler that forgets to implement a method inherits a thrower. The failure is immediate and loud — not a silent wrong result. **This is the "cannot violate" mechanism**: the default is a loud failure, never a no-op.

An implementing handler merges over the contract:

```js
module.exports = Object.assign({}, iOp, {
    name: 'dsl',
    resolve,
    process,
    validate,
    execute,
    compile,
    expand,
});
```

Missing any of `validate`, `execute`, `compile`, `expand`? The iOp default fires and the system tells you exactly which method is missing.

---

### 1.4 Hexagonal Architecture — the domain is the centre

Hexagonal Architecture (Cockburn) makes the same insight as rule 1.1 more precise: the **domain is the centre**; everything else is an **adapter** that plugs into a **port**.

```
    [HTTP adapter]  [CLI adapter]  [Test adapter]
            ↓              ↓              ↓
    ┌──────────────────────────────────────────┐
    │         Port (inbound interface)         │
    │  ──────────────────────────────────────  │
    │           Domain / Business logic        │
    │  ──────────────────────────────────────  │
    │         Port (outbound interface)        │
    └──────────────────────────────────────────┘
            ↓              ↓              ↓
    [DB adapter]  [API adapter]  [Queue adapter]
```

- **Ports** are the contracts at the domain boundary — the `iProvider.js`, `iOp.js` files. The domain defines them; adapters implement them.
- **Adapters** are the implementations — the edge layer (HTTP), the repo layer (database), the ops layer (external functions). They plug into ports.
- The domain **never depends on adapters**. Adapters depend on ports.

The key test: **can you test the domain with no adapters at all?** If you need a running database or HTTP server to unit-test business logic, an adapter has leaked into the domain. `factory.js` and `spec.js` are pure domain — no I/O, testable with plain function calls. `repo.js` is an adapter. `edge/api/<resource>/` is an adapter.

**Studio example:**
`core/<entity>/factory.js` + `core/<entity>/spec.js` = domain (pure, no I/O).
`core/<entity>/repo.js` = outbound adapter (database port).
`edge/api/<resource>/` = inbound adapter (HTTP port).
The domain can be fully unit-tested by calling `factory.create` and `spec.isValid` with plain objects — no Koa, no Neo4j required.

---

## Part 2 — Contracts

### 2.1 Split decision from action — the two-verb rule

Whenever a dispatch point has two concerns — "should I handle this?" and "do the work" — split them into two named functions. Never merge them.

| Verb role | Name pattern | Responsibility | Must be |
|---|---|---|---|
| Decision | `resolve`, `matches`, `claims`, `owns`, `accepts` | Pure predicate: does this input belong to me? Returns identity only. | Side-effect free |
| Action | `process`, `execute`, `handle`, `apply`, `build` | Does the work: builds output, writes state, executes side effects. | Called only after decision confirmed |

**The framework owns the transition between the two.** Decision runs; framework stamps shared state; action runs. Neither the caller nor the implementer controls the ordering.

**Studio example:**

```js
// ops/index.js — the framework owns the transition
for (const handler of R.values(handlers)) {
    const verdict = handler.resolve(payload);    // ← decision: pure, no side effects
    if (verdict && verdict.resolved) {
        envelope.shape = verdict.shape;          // ← framework stamps identity
        handler.process(payload, q, envelope);   // ← action: only runs after decision
        break;
    }
}
```

`handler.resolve` cannot accidentally write `envelope.shape` — the framework owns that line.
`handler.process` cannot accidentally run without a resolved handler — it is inside the `if (verdict.resolved)` branch.
The split makes partial implementation and accidental ordering impossible by construction.

---

### 2.2 Pure predicates have zero side effects

A function named as a predicate — `resolve`, `matches`, `isValid`, `claims`, `owns` — must be:

- Deterministic given the same input
- Side-effect free: no log, no mutation of shared state, no I/O, no throw
- Return value only: a boolean, a `{ resolved, shape }` object, a typed verdict

If a predicate throws on invalid input, it is a **validator**, not a predicate. Name it accordingly (`isValid`, `isAllowed`) and place it in the Validator layer.

---

### 2.3 Contracts declare ALL required methods; none are optional

A contract with optional methods is not a contract — it is a suggestion.
Every method on the interface is required. If a new handler genuinely does not need one verb (e.g. `compile` for a stateless op), it still implements it — returning a well-defined empty value, not skipping it.

The only legitimate variation is a **stub** — a handler that is recognized but not yet filled in. A stub satisfies the contract with explicit `notImplemented` throwers, making its incomplete state visible and intentional.

---

### 2.4 TypeScript for greenfield: move contracts to compile time

For greenfield projects, use TypeScript. TypeScript elevates rule 1.3 from runtime enforcement (throwing defaults) to compile-time enforcement (type errors). A missing method, a wrong argument shape, or a mismatched return type is a build failure — not a runtime discovery in a code path that may not be exercised for weeks.

| Approach | Contract enforcement | When violation is caught |
|---|---|---|
| `iX.js` throwing defaults (JavaScript) | Runtime — first call to the missing method | When that code path is exercised in a test or in production |
| TypeScript `interface` | Compile time — type checker runs on every save | Before the process starts |

Both are valid. TypeScript is strictly stronger. It catches the full contract surface, not just methods that happen to be exercised in a test run.

**How to express contracts in TypeScript:**

```ts
// iOp.ts — the interface IS the contract; no default throwers needed
interface IOp {
    readonly name:        string;
    readonly description: string;
    resolve(payload: Payload): ResolveResult;
    process(payload: Payload, q: Query, envelope: Envelope): void;
    validate(step: Step, recipe: Recipe): void;
    execute(step: Step, ctx: Context, priors: Priors): Promise<StepResult>;
    compile(step: Step): string | object;
    expand(step: Step, ctx: Context): Promise<Artifact>;
}
```

```ts
// ops/dsl/index.ts — TypeScript enforces the full contract at compile time
export const dslOp: IOp = {
    name:        'dsl',
    description: 'Default single-source DSL query',
    resolve:  (payload)           => { /* ... */ },
    process:  (payload, q, env)   => { /* ... */ },
    validate: (step, recipe)      => { /* ... */ },
    execute:  async (step, ctx, priors) => { /* ... */ },
    compile:  (step)              => { /* ... */ },
    expand:   async (step, ctx)   => { /* ... */ },
    // omit any method → TypeScript error at build time, not runtime
};
```

**The rule:** For every new system or module designed from scratch, use TypeScript and define all layer contracts as `interface` declarations. The `interface` file replaces `iX.js`. The compiler is the enforcement mechanism. For existing JavaScript codebases, use the throwing-defaults pattern from rule 1.3.

---

### 2.5 Encapsulation: hide everything that isn't in the contract

A contract defines what is public. Encapsulation enforces that everything else is hidden. These are two sides of the same rule — a contract without encapsulation is meaningless, because callers can bypass it.

**The three levels of encapsulation:**

| Level | What is hidden | Mechanism |
|---|---|---|
| **Data** | Internal state; mutable fields | Expose through methods that enforce invariants — never expose raw mutable state directly |
| **Implementation** | How something is done | Callers depend on *what* a module does, not *how*. Internals can change freely as long as the contract holds. |
| **Module** | Private helpers and internal structure | Only the public surface is exported. Internal functions, constants, and types are not exported. |

**Private by default.** Start with everything private or unexported. Make something public only when a caller demonstrably needs it. Every public method is a promise to every caller — the more promises you make, the harder the module is to change.

**The narrow public surface test:** Can you list every public method in one line? If not, the surface is too wide. Trim it to the operations callers actually use.

**Studio examples:**

`recipe.value` is a JSON string — opaque above the provider layer. Callers see a string. Only the provider knows the internal structure `{ shape, plan, ...opExtras }`. If the internal shape changes, callers are unaffected.

```js
// plan.js — five exports; everything else is module-private
module.exports = { isPlan, validate, join, make, append };

// valueAt and keyOf are internal helpers — not exported, not reachable by callers
const valueAt = (row, dottedKey) => R.path(dottedKey.split('.'), row);
const keyOf   = (cols) => (row) => R.map((c) => valueAt(row, c), cols).join('|');
```

```js
// result.js — two exports; make() is the only constructor
module.exports = { make, noPlan };
// Callers cannot reach the NO_PLAN constant or the internal assembly logic
```

Op-private envelope keys: `envelope.cypher`, `envelope.nlp` are written by one Op and read by that same Op. No other handler, engine, or orchestrator reads them. This is encapsulation at the data level — private state stamped into a shared structure but owned by one writer.

**What breaks encapsulation — and what to do instead:**

| Violation | Fix |
|---|---|
| Exposing a mutable array or object from a getter | Return a copy, or expose only the operations callers need (`add`, `remove`, `find`) |
| A caller reading an internal field directly (`plan._steps`) | Expose a method (`plan.steps` or `plan.stepCount`) |
| An Op reading another Op's private envelope keys | Move shared state into `step.args` (the step-level contract) or the connector |
| A module exporting internal constants just because another file needs one | The constant belongs in the module that owns the concept; the other file imports the module, not the constant directly |
| A layer passing its raw internal object to the next layer | Map to a boundary type at the layer crossing; never let the internal representation leak across a boundary |

**Encapsulation and contracts are paired.** The contract says: *this is the surface.* Encapsulation says: *everything else is mine.* Together they make the module replaceable — callers depend only on the contract, so the implementation can be rewritten without touching them.

---

### 2.6 Tell Don't Ask

Tell an object to do something rather than asking for its state and making a decision outside it.

```js
// BAD — Ask: query state, then act on it outside the object
if (recipe.isArchived()) {
    recipe.setArchivedAt(Date.now());
    recipe.setArchivedBy(user.id);
    recipe.setArchivedReason(reason);
}

// GOOD — Tell: the object owns what archiving means for itself
recipe.archive(user, reason);
```

**Why it matters:** asking pulls private state out. The caller now contains logic that belongs to the object — specifically, "when archived is true, these fields must also be set." Any change to what archiving means requires hunting down every caller that asks-and-acts. Telling keeps that logic in one place, next to the state it protects.

**The Tell Don't Ask test:** if a block of code reads properties from an object and then calls a method on that same object based on those properties, the block belongs inside the object.

This is encapsulation (rule 2.5) applied at the call level. If you are asking for state to make a decision, you are breaking encapsulation — the decision belongs inside the object that owns the state.

**Studio examples:**
`factory.create(input)` — tell the factory to build; the caller does not assemble fields manually.
`spec.isValid(recipe)` — tell the spec to validate; the caller does not check individual fields.
`repo.archive(uuid, user)` — tell the repo to archive; the caller does not set `archived = true` directly.

---

### 2.7 Law of Demeter — only talk to your immediate collaborators

A method may only call methods on:
1. Itself
2. Objects it holds as fields
3. Objects passed as arguments
4. Objects it creates locally

It must NOT call methods on objects **returned by** other calls. The symptom is the train wreck: `a.getB().getC().doSomething()`.

```js
// BAD — train wreck: caller depends on A's structure AND B's structure AND C's structure
const zip = user.getAddress().getCity().getZipCode();

// GOOD — tell the object to return what you need
const zip = user.getZipCode();   // User knows how to reach its own zip code
```

**Why it matters:** a train wreck creates hidden coupling. The caller depends on: `user` having an `address`, `address` having a `city`, `city` having a `zipCode`. Change any one of those and the caller breaks — even though the caller only ever wanted a zip code.

**In the context of layers:** the Law of Demeter forbids `edge` from reaching through `core` to `repo` — that is a layer-level violation. It forbids an Op from reaching into another Op's private envelope keys — a data-level violation. It forbids a handler from calling `ctx.getState(key).user.permissions.admin` — an object-level violation.

**The Demeter test:** count the dots in any method call chain. More than one dot accessing a different object's methods (not fluent builder chains) is a Demeter smell.

---

### 2.8 LSP — Liskov Substitution Principle

Any implementation of a contract must be **fully substitutable** for any other implementation of the same contract. Callers that depend on the contract must never need to know which concrete implementation they have.

In plain terms: if something promises to do X, it must do X — not a weakened or partial version of X. A subtype that does less than its base type promises is not a substitute; it is a different thing wearing the same interface.

**Violations:**
- An implementation that throws on a method the contract says should succeed
- Code that checks `if (x instanceof ConcreteType)` to decide behaviour — the caller has leaked knowledge of the implementation
- An Op that implements `execute` but silently ignores `validate` — callers that rely on validation being called are broken

```js
// BAD — caller cannot treat all Ops uniformly; has to know the concrete type
const op = ops.route(step.operation);
if (op.name === 'dsl') {
    await op.validate(step, recipe);  // only validated for DSL
}
await op.execute(step, ctx, priors);

// GOOD — every Op is substitutable; the engine treats them all identically
const op = ops.route(step.operation);
await op.validate(step, recipe);      // every Op honours this
await op.execute(step, ctx, priors);  // every Op honours this
```

**Studio example:**
Every Op implements the full `iOp` contract — `validate`, `execute`, `compile`, `expand`. The engine calls all four on any Op without knowing which one it has. `dslOp`, `xOxComparerOp`, and `chainOp` are fully substitutable at the `IOp` interface. The `iOp.js` throwing defaults make LSP violations immediately visible: an Op that skips `expand` is caught on first call.

**LSP and the contract rule (1.3) are paired:** the contract defines the promise; LSP says every implementer keeps the full promise. An implementer that satisfies only some methods is not a substitute — it violates the contract.

---

### 2.9 ISP — Interface Segregation Principle

Callers should not be forced to depend on methods they do not use. A wide interface that serves multiple caller types should be split into focused, minimal interfaces — one per caller role.

```ts
// BAD — one fat interface; a read-only caller is forced to depend on write methods
interface IRecipeStore {
    get(uuid: string): Recipe;
    list(): Recipe[];
    save(recipe: Recipe, user: User): void;
    update(uuid: string, patch: Patch, user: User): void;
    archive(uuid: string, user: User): void;
}

// GOOD — split by what each caller actually needs
interface IRecipeReader {
    get(uuid: string): Recipe;
    list(): Recipe[];
}
interface IRecipeWriter {
    save(recipe: Recipe, user: User): void;
    update(uuid: string, patch: Patch, user: User): void;
    archive(uuid: string, user: User): void;
}
```

**Why it matters:** when a caller depends on a fat interface, any change to a method the caller never uses can still recompile or break the caller. Focused interfaces mean a change to write logic cannot affect a read-only consumer.

**ISP and encapsulation (2.5) are paired:** encapsulation says "export only what callers need." ISP says "when different callers need different things, define different interfaces." Together they produce contracts that are narrow, purposeful, and independently evolvable.

**Studio example:**
`iOp.js` defines the full Op contract because every path — resolution, execution, compilation, profiling — uses all the methods. If a future consumer only needed `compile`, the right design would be an `ICompilable` sub-interface, not forcing that consumer to depend on `execute`, `validate`, and `expand`.

---

## Part 3 — Extension

### 3.1 New behavior = new file. Never edit the orchestrator.

A system is extensible when adding a new behavior requires adding a new file, and zero edits to any existing file. This is OCP made operational.

The mechanism:
1. A **registry** discovers handlers at startup (by directory scan, by convention, or by explicit list)
2. Each handler is **self-declaring**: it announces what it handles, how it handles it, and what it needs
3. The orchestrator **iterates the registry** — it never names a handler by type

If adding a new handler requires editing the orchestrator, factory, engine, or registry — the system is closed. A `switch` or `if/else` over types is the smell. A registry with self-declaring handlers is the fix.

**Studio example — before (closed):**

```js
// factory.js — BAD: centralized switch
const detectOp = (payload) => {
    if (payload.chain) return 'chain';
    if (payload.period?.type === 'xox') return 'xOxComparer';
    return 'dsl';   // ← adding cypher op requires editing this file
};
```

Every new op type is an edit to `factory.js`. The file has knowledge of every handler's resolution logic.

**After (open):**

```js
// ops/index.js — registry iterates; no handler is named
const resolve = (payload) => {
    for (const handler of R.values(handlers)) {
        const verdict = handler.resolve(payload);
        if (verdict && verdict.resolved) return { op: handler, shape: verdict.shape };
    }
    // fall back to default op if one is flagged
};
```

```js
// ops/xOxComparer/index.js — self-declaring; owns its own detection logic
const resolve = (payload) => {
    if (R.path(['period', 'type'], payload) !== 'xox') return { resolved: false };
    return { resolved: true, shape: NAME };
};
```

Adding a `cypher` op = create `ops/cypher/index.js`. Zero edits to `ops/index.js`, `factory.js`, or `engine.js`.

---

### 3.2 Convention is the registration — use auto-discovery

Manual registration lists grow stale. A file in the right place with the right shape should register itself.

The auto-discovery pattern:
- The registry scans a known directory at module-load
- Any subdirectory with an `index.js` exporting the required field (`name`, `type`, `kind`) is a handler
- Missing required field: log a warning and skip — never crash silently, never succeed silently

**Studio example:**

```js
// ops/index.js
const discover = () => {
    const out = {};
    for (const entry of fs.readdirSync(__dirname, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const handler = require(`./${entry.name}`);
        if (!handler || !handler.name) {
            log.warn(`ops: handler at ./${entry.name} has no name; skipping`);
            continue;
        }
        out[handler.name] = handler;
    }
    return out;
};
```

Drop `ops/cypher/index.js` → it appears in the registry at next process start. No registration file to edit.

---

### 3.3 Each handler owns its entire domain

A handler owns everything about its own behavior:

- **What inputs it claims** — its resolution predicate
- **What defaults it applies** — its own constants, not the orchestrator's
- **What private state it writes** — its own envelope keys, not shared schema
- **What its execution looks like** — its own step logic

If defaults for a handler live in the orchestrator, the orchestrator has knowledge of a specific handler's business. That is a layer violation. Move them inside the handler.

**Studio example:**

```js
// xOxComparer/index.js — defaults live inside the Op that uses them
const OPTS_DEFAULTS = { compare: 'dow', displaySingleMetric: false };

const buildArgs = (q, payload) => ({
    dim:       qJson.d,
    metrics:   qJson.m,
    opts:      R.merge(OPTS_DEFAULTS, R.pick(R.keys(OPTS_DEFAULTS), userOpts)),
    // ...
});
```

The orchestrator knows nothing about `compare: 'dow'`. Changing xOxComparer's defaults is a one-file change inside `ops/xOxComparer/`.

**Corollary — op-private envelope keys:**
A handler may write private keys into a shared envelope (`envelope.cypher`, `envelope.nlp`). Only that handler may read them. No other handler, engine, or orchestrator reads keys it did not write. Encapsulation at the data level, not just the code level.

---

### 3.4 DRY: every piece of knowledge has exactly one home

"Don't Repeat Yourself" is not about avoiding copy-paste. It is about ensuring that **every piece of knowledge in the system has a single, authoritative location**. When that knowledge changes, exactly one place changes — no synchronisation required, no risk of drift.

**The single-authoritative-location test:**
For any piece of information — a field list, a rule, an allowed-value set, a shape, a type, a default — ask: *if this changes, how many files must change?* If the answer is more than one, duplication exists.

Duplication to watch for:

| Kind | Example of duplication | Single home |
|---|---|---|
| **Logic** | Same conditional in the handler and in the spec | Spec only |
| **Schema / field list** | Same fields in `factory.create`, in the serialiser, and in the test fixture | `factory.create` is canonical; others derive from it |
| **Allowed values** | `['query', 'pipeline']` defined in `factory.js` AND `spec.js` | `spec.js` constant (or `constants.js` if shared across layers) |
| **Output shape** | Result keys defined per-Op and again in the consumer | `result.make()` is the only constructor |
| **Type + runtime check** | TypeScript interface AND a hand-written runtime guard for the same shape | Use a schema library (Zod, io-ts) that derives both from one source |
| **Defaults** | Op defaults in the Op AND in the orchestrator | Inside the Op only (rule 3.3) |

**Studio example:**

`VALID_TYPES = ['query']` is defined once in `spec.js`. The factory uses the spec's shape to build entities; it does not re-declare the allowed types. If a second `FACTORY_TYPES` array existed in `factory.js` and drifted from `VALID_TYPES`, the system would accept a type in the factory and reject it in the spec — a confusing, hard-to-trace bug from a two-line duplication.

**The DRY–OCP relationship:**
DRY and OCP enforce each other. A duplicated rule is closed to a single change: you must update two places. A central registration list that every new handler must edit is a DRY violation — "the list of handlers" exists in two places (the file and the list). Auto-discovery (rule 3.2) eliminates that duplication by making the file itself the registration.

---

### 3.5 YAGNI — build what is needed now, not what might be needed later

"You Aren't Gonna Need It." Do not build infrastructure, abstractions, or features that are not required by the current problem.

**The rule of three:**
- One implementation → write it directly, inline.
- Two implementations → note the similarity; resist the urge to abstract.
- Three implementations → the abstraction has earned its place. Now introduce it.

Abstracting at one or two instances is speculation. Speculation adds complexity without a proven requirement. The cost of the wrong abstraction is higher than the cost of waiting — a wrong abstraction locks in assumptions that the third case will violate.

**What YAGNI bans:**
- Unused parameters or flags added "for future use"
- Abstraction layers with only one concrete implementation
- Plugin systems before there are plugins
- Configuration options for behaviour that does not yet need to vary
- Generic base classes with no children
- "Future-proofing" that adds cognitive load without serving a current need

**YAGNI and OCP work together, not against each other.** OCP says *design for extension*; YAGNI says *don't build the extension point until you need to extend*. They are not contradictory — OCP is about structure, YAGNI is about timing. Build the switch first. When the second variant arrives, feel the pain. When the third arrives, introduce the registry.

**Studio example:**
The Ops registry was introduced when `dsl`, `xOxComparer`, and `chain` all existed and the `detectOp` switch was genuinely painful. If there had been only `dsl`, a registry would have been YAGNI — speculative infrastructure for variation that had not yet appeared.

---

### 3.6 Composition over Inheritance

Prefer building behaviour by **composing objects** over inheriting from a base class. Inheritance creates tight compile-time coupling between child and parent. Composition keeps behaviour replaceable and independently testable.

**Why inheritance causes problems:**
- A child class inherits implementation details of the parent — a change to the parent can silently break every child (the fragile base class problem)
- To reuse behaviour, you must accept the entire parent class, including the parts you don't want
- Deep hierarchies are hard to trace: you must read the full chain to understand what any method does

**Why composition works better:**
- Each object depends only on the interfaces it uses, not on any implementation
- Composed pieces can be swapped, mocked, and tested independently
- Multiple behaviours can be combined without a class explosion

```ts
// BAD — inheritance: DslOp is locked to BaseOp's implementation details
class BaseOp {
    async execute(step, ctx, priors) { /* base behavior leaks into DslOp */ }
}
class DslOp extends BaseOp {
    async execute(step, ctx, priors) {
        super.execute(step, ctx, priors); // coupled to parent's internals
    }
}

// GOOD — composition: contract + specific overrides, no parent coupling
const dslOp: IOp = Object.assign({}, iOp, {
    name:    'dsl',
    resolve: (payload) => { /* ... */ },
    execute: async (step, ctx, priors) => { /* ... */ },
    // inherits iOp's throwing defaults for any unimplemented method
});
```

**The test:** if you are creating a class hierarchy to share behaviour, stop. Define an interface, create default implementations, and compose. Inheritance is appropriate only when you truly need the "is-a" relationship and the Liskov Substitution Principle holds across the entire hierarchy.

**Composition and OCP work together.** OCP says add behaviour without editing existing code. Inheritance forces you to edit (override) the parent. Composition lets you add by creating a new piece and wiring it in.

**Studio example:**
Every Op handler uses `Object.assign({}, iOp, { name, resolve, ... })` — composition of the contract defaults with the handler's specific behaviour. There is no `BaseOp` class, no inheritance chain. Each Op is a self-contained object that happens to satisfy the `IOp` interface. Swapping one Op for another requires no changes to the hierarchy — there is no hierarchy.

---

## Part 4 — Vocabulary

### 4.1 Define two vocabularies: author and engine

Any system with an authoring surface (what someone composes) and an execution surface (what the system runs) has two vocabularies. Name them explicitly and keep them separate.

| Vocabulary | Who uses it | When |
|---|---|---|
| **Author / source** | The composer — person or upstream system | Authoring / creation time |
| **Engine / plan** | The runtime | Execution / query time |

A **bridge function** (`getPlan`, `compile`, `resolve`, `translate`) converts from author vocabulary to engine vocabulary. The conversion happens once, at a defined moment. After the bridge runs, only engine vocabulary is used.

Never let engine vocabulary leak into author vocabulary, or vice versa.

**Studio example:**

```
source  ::=  fluent-query | cypher | text | chain( source+ ) | recipe
plan    ::=  dsl | xox | cypher | text | chain( plan+ )

getPlan(source) → plan     ← the bridge; runs at preview / execute time
```

`xox` is an engine concept — it does not appear in `source`. It is inferred from a `fluent-query` source at bridge time when `period.type === 'xox'`. Authors never write `xox` directly. This keeps the authoring surface clean and the engine surface precise.

If `xox` leaked into `source`, authors would need to know an engine implementation detail. A change to how xox is detected would also require an authoring-surface change. The vocabulary boundary prevents this coupling.

---

### 4.2 Write invariants as explicit one-line statements

Invariants are the non-negotiable constraints the system enforces. They are not guidelines. Write them in a dedicated section of your design document.

**Format:** *"[Subject] [verb] [constraint]. [Consequence of violation]."*

**Studio example — from `dispatcher.md`:**

> Shape is resolved once, persisted forever. Re-dispatch from raw payload only at authoring time.
>
> The Plan is the compiled form. No re-translation needed between persistence and execution.
>
> Adding a new op is one folder. No edits to Engine, factory, or registry required.
>
> Op-private extras are private. Only the owning Op reads keys it wrote into the envelope.
>
> One Engine per outer provider. Engines do not select strategies; Ops do.

Each invariant makes a specific wrong design immediately identifiable. Code that re-derives `recipe.shape` from the payload at execution time violates invariant 1 — there is no ambiguity, no debate.

---

### 4.3 Resist new top-level concepts for variations

When a new case arrives, the reflex is to add a new concept. The correct reflex is: *can this be expressed by composing existing primitives?*

The test:
- **Variation** — same entity, different behavior. Handle with a strategy or handler. Do not add a new entity type.
- **Genuinely new** — no existing primitive covers it even with composition. Only then: add a new primitive.

If it can be handled by composition, handle it that way.

**Studio example:**

A "Pipeline" (multi-source query) was proposed as a separate entity type with its own routes, core, repo, and provider. Instead: a Pipeline *is* a Recipe whose Plan has multiple steps. Same entity, same routes, same persistence. The `plan.steps` array handles it. No new concept required.

Corollary: if `if (recipe.type === 'pipeline')` appears in the orchestrator, the design has drifted into special-casing. The strategy pattern (each type is a handler) is the fix. If a new type requires editing the orchestrator, the system is closed.

---

### 4.4 Intention-revealing interfaces: names expose purpose, not mechanism

A name is a contract with the reader. It must answer: **what does this do?**
Not: how is it implemented. Not: what technology it uses. Not: what the developer was thinking.

**Three tests for a good name:**

1. **Can you understand it without reading the body?**
   If you need to read the implementation to understand the name, the name has failed.

2. **Would the name still be correct if the implementation changed?**
   `fetchUserFromRedis` breaks its name the moment the cache moves. `getUser` survives any storage change.

3. **Is it written from the caller's point of view, not the implementer's?**
   Callers care about what they get back. Implementers care about how they produce it. Name from the caller's perspective.

**Naming patterns by role:**

| Role | Pattern | ✅ Good | ❌ Bad |
|---|---|---|---|
| Predicate / condition | `is<State>`, `has<Property>` | `isValid`, `hasExpired`, `isAllowed` | `checkValidity`, `verifyState`, `runPermissionCheck` |
| Query / getter | `get<Thing>`, `find<Thing>` | `getUser`, `findRecipesByTag` | `fetchUserFromDatabase`, `queryRecipesByTagUsingIndex` |
| Command / mutation | verb describing the outcome | `archive`, `promote`, `publish` | `setArchivedFlagToTrue`, `updatePublishedStatus` |
| Factory | `make`, `create`, `build` | `makePlan`, `createRecipe` | `instantiateRecipeObject`, `buildObjectUsingInputData` |
| Contract / interface | `I<Name>` (TS) or `i<Name>.js` | `IOp`, `IProvider`, `iOp.js` | `RecipeInterface`, `OpProtocol`, `RecipeMethods` |
| Bridge / transform | verb describing the outcome | `compile`, `resolve`, `toPlan` | `convertInternalRepresentationToExecutionPlan` |

**What to avoid:**

- **Mechanism in the name** — `fetchFromRedis`, `writeToPostgres`, `parseJSON`
  → rename to describe what is returned: `getSession`, `saveEvent`, `readConfig`

- **Filler words** — `Manager`, `Helper`, `Util`, `Service`, `Handler`
  → name the specific thing: `UserSession`, `RecipeEngine`, `PlanBuilder`

- **Misleading precision** — if `getActiveUsersForTodayByRegion` is locked to today's date as an implementation detail, the name is a lie the moment the query changes. Use `getUsers(filter)`.

- **Boolean parameters that invert meaning** — `process(data, true)` where `true` means "skip validation"
  → name the two behaviors: `processRaw(data)` vs `process(data)`, or use an options object: `process(data, { validate: false })`

**Studio example:**

The two-verb split (rule 2.1) is an intention-revealing design. `resolve` means *decide if this is mine*. `process` means *do the work*. The names make the protocol legible at a glance. Compare to a single `handle(payload)` function that secretly decides and acts in one call — the name hides the two-phase protocol entirely.

`isValid(entity)` and `isAllowed(entity, ctx)` — predicate form. These names answer a yes/no question. If they returned `false` silently, the names would still be correct. They happen to throw on failure — that is an implementation choice, not the name's promise.

`ops/dsl`, `ops/xOxComparer`, `ops/chain` — folder names reveal the operation type. A developer who knows nothing about the system can guess what each folder does by its name.

---

### 4.5 Ubiquitous Language and Bounded Contexts (DDD)

**Ubiquitous Language:** every concept in the domain has exactly one name, shared by developers, domain experts, product managers, and designers. That name is used in code, in routes, in documents, in conversations. No synonyms. No translations between layers.

If a developer calls it `recipe` and a product manager calls it `report`, the ambiguity must be resolved — pick one word and use it everywhere. Code that uses the agreed word and documentation that uses the agreed word are the same thing. Reading the code teaches you the domain.

**Violations:**
- `recipe` in the API, `savedQuery` in the code, `report` in the UI — three names for one concept
- Converting between names at layer boundaries: `req.body.report → recipe` in the handler
- Using technical names where domain names exist: `queryDefinition` instead of `recipe`

**Studio example:**
The storyboard defines the vocabulary — Recipe, Ingredient, Workbench, Mode, Canvas, Catalog. These exact words appear in routes (`/recipes`), in field names (`recipe.value`), in handler verbs (`recipe.create`), in design docs, and in conversations. A new developer learns the domain by reading the code. There is no translation layer.

---

**Bounded Context:** a large system contains multiple domains. Within each bounded context, a word means one precise thing. Across context boundaries, the same word may mean something entirely different — and that is acceptable, as long as the boundary is explicit.

The rule: **never share a domain model across bounded context boundaries**. Share data via an explicit translation (an **Anti-Corruption Layer**), not by importing each other's entities directly.

| Without ACL | With ACL |
|---|---|
| `studio` imports `reporting`'s `Recipe` class | `studio` defines its own `Recipe`; a translator maps between them at the boundary |
| A change to `reporting.Recipe` breaks `studio` | Each domain evolves independently; the translator absorbs the difference |

**Studio example:**
`app/module/studio/` is a bounded context. `Recipe` inside it means a saved query with ingredients. If a separate `reporting` module also uses the word `recipe` for something different, that is not a naming error — they are different concepts inside different bounded contexts. Each module owns its own entity definitions. Cross-module communication goes through explicit translators, not shared imports of each other's `core/<entity>/` internals.

---

## Part 5 — Validity

### 5.1 Validate at every boundary before crossing it

Validation is not a single gate at the system entry. Each layer boundary validates what it receives before doing any work:

| Boundary | What is validated | Surface |
|---|---|---|
| Presentation → Orchestration | Caller identity only — is there a valid user/session? | Auth check |
| Orchestration → Domain | Does the entity exist? Is the type valid for this operation? | Pre-condition checks |
| Domain — Spec sync | Is the entity structurally valid? (fields, types, lengths, enums) | `isValid(entity)` |
| Domain — Spec async | Is the entity allowed by domain rules? (uniqueness, references, quota) | `isAllowed(entity, ctx)` |
| Execution — Plan | Is the plan structurally valid? Does it have steps? | `plan.validate(p)` |
| Execution — Step | Are this step's args valid for its op type? | `op.validate(step, recipe)` |

**Order:** sync before async, cheap before expensive. Never spend a database round-trip when a cheap predicate would have rejected.

---

### 5.2 Error messages name the field, the rule, and the offending value

A validation error with no context is user-hostile and developer-hostile. Every thrown error names three things:

1. **The field** that failed
2. **The rule** it failed against (length, type, membership, uniqueness)
3. **The actual offending value**

```js
// BAD — no field, no rule, no value
throw new Error('invalid input');
throw new Error('name required');

// GOOD — field + rule + offending value
throw new Error(`name must be 1–200 chars; got "" (length 0)`);
throw new Error(`type must be one of [query, pipeline]; got "graph"`);
throw new Error(`tag exceeds 64 chars: "this-tag-is-way-too-long-to-be-useful-but-someone-tried"`);
```

The error must be actionable without reading the source code.

---

### 5.3 The canonical output shape is defined in one place

Every component that produces a result produces the same shape. That shape is defined in one place (`result.js`, `response.js`, `output.js`). Adding a new top-level key means editing that one place — never adding it ad-hoc inside a handler or op.

This is the "single source of truth for output" rule. It keeps all producers and consumers in lockstep.

**Studio example:**

```js
// result.js — the ONLY place a result key is introduced
const make = (input = {}) => ({
    rows:  R.propOr([], 'rows', input),
    cols:  R.propOr([], 'cols', input),
    query: R.propOr('', 'query', input),
    plan:  R.propOr(NO_PLAN, 'plan', input),
    vizs:  R.propOr([], 'vizs', input),
    ...R.omit(['rows', 'cols', 'query', 'plan', 'vizs'], input),
});
```

An Op that returns `{ data: rows }` instead of `{ rows }` breaks every consumer silently — the consumer gets `undefined` where it expects data. The canonical shape prevents this: all Ops call `result.make(...)` and consumers depend on it, not on individual Op return shapes.

---

## Part 6 — Operations

### 6.1 Identity is stamped once and persisted

An entity's identity — type, shape, kind — is resolved once at creation time and persisted with the entity. It is never re-derived from raw payload at read or execution time.

Why: re-derivation means behavior can change as resolver logic evolves. Persisted identity makes behavior stable, auditable, and independent of future code changes.

**Studio example:**
`recipe.shape` is stamped by the factory during authoring (`envelope.shape = shape`). At execution time, the engine reads `recipe.shape` and routes directly. If the resolver logic changes in the future, existing recipes are unaffected — their shape is locked in the database.

The invariant: *re-dispatch from raw payload only at authoring time, never at execution time*.

---

### 6.2 Soft delete; treat audit fields as load-bearing

Physical deletion removes the audit trail. Any system where "what happened and when" matters should use soft delete.

Soft delete requires:
- A boolean flag (`archived`, `deleted`, `disabled`) on the entity
- A companion timestamp (`archivedAt`) and actor (`archivedBy`) field
- An optional reason field (`archivedReason`) for systems where provenance matters
- All reads filter on `NOT <flag>` unless the caller explicitly opts into deleted records

The audit fields (`createdAt`, `createdBy`, `updatedAt`, `updatedBy`) are not optional metadata. They are the provenance record. They are stamped in the persistence layer on write — not by the caller.

---

### 6.3 Delete old wrong designs — never shim them

When a design decision is wrong, delete the old code. Do not layer a shim on top of it.

Shims:
- Preserve old behavior while new behavior runs in parallel
- Become permanent when no one removes them
- Make the codebase's actual design impossible to read

The cost of a clean cut (migration, re-test) is paid once. The cost of a shim compounds with every subsequent change.

**Studio example:**
When the centralized `detectOp` switch was recognized as an OCP violation, it was deleted — not wrapped. `dispatcher/`, `typeResolver.js`, `recipe.queryType`, and `summary.js` were all removed in the same PR that introduced the registry. The codebase reflects only the current design. There is no vestigial path that a future developer might follow by accident.

---

## Part 7 — Proactive Application

### 7.1 Scan for pattern opportunities on every review — not only when asked

When reviewing a design, a code change, or a PR: **identify applicable patterns before accepting the design**. Do not wait to be asked. Working code with a poor structure is a future defect; the cheapest moment to fix it is before more code depends on the structure.

**The three-step obligation:**

1. **Name it** — identify the smell and the pattern by name. *"This `if/else` on type is a Strategy violation"* is more useful than *"this could be cleaner."*
2. **Show it** — provide a before/after sketch, even two-line pseudocode. Make the refactor concrete.
3. **Propose it** — state the action: *"extract into a handler under `ops/<name>/index.js`"*, *"move this default into the owner"*, *"introduce a Gateway for the external API."*

### 7.2 Smell → Pattern table — scan this on every design review

| Smell | Pattern | What changes |
|---|---|---|
| `if (type === 'X') … else if (type === 'Y')` in an orchestrator | **Strategy** | Each branch becomes a self-contained handler; orchestrator iterates, never names them |
| Request passed to multiple handlers until one claims it | **Chain of Responsibility** | Sender dispatches blindly; handlers self-select |
| Fixed sequence with variable per-step behaviour | **Template Method** | Skeleton lives in one place; steps are filled in by collaborators |
| Many optional construction params or phases | **Builder** | Step-by-step construction; caller composes only what it needs |
| Two things behave differently but callers use them identically | **Adapter** | Incompatible interface wrapped; caller never sees it |
| Complex subsystem exposed directly to callers | **Facade** | One clean entry point hides the internals |
| Cross-cutting concern (logging, caching, auth, metrics) mixed into business logic | **Decorator** | Concern wraps the object; both sides stay clean and independent |
| Recursive structure; nodes and leaves treated differently | **Composite** | Both treated uniformly by the caller |
| Same predicate or business rule in multiple places | **Specification** | Single reusable predicate; composed, not duplicated |
| Manual registration list every new handler must edit | **Registry** + auto-discovery | Drop the list; a correctly-shaped file in the right place is the registration |
| Parts of the system manually told when something changes | **Observer** / Domain Event | Producer emits; consumers subscribe; neither knows about the other |
| Many objects cross-wired to each other | **Mediator** | One coordinator; objects talk through it, not to each other |
| Need to add operations to an existing stable hierarchy | **Visitor** | New operations without touching existing classes |
| External API or service calls scattered in business logic | **Gateway** | One translation boundary; domain never sees the external interface |
| Same logic in two or more places | **DRY** — extract | One authoritative location; change once |
| Primitive value carrying domain meaning | **Value Object** | Named type with domain behaviour; equality by value |
| Method clearly belongs in a different layer | Move it (**SRP**) | Each layer has one job |
| Function doing two distinct things | Extract Function (**SRP**) | One function, one job; both are now nameable |
| Object with fields from two different concerns | Split into two objects (**SRP**) | Each object has one reason to change |
| Querying object state to make a decision outside it | **Tell Don't Ask** | Decision belongs inside the object that owns the state |
| Call chain crossing more than one object boundary (`a.b().c()`) | **Law of Demeter** | Caller depends only on its immediate collaborator |
| Abstraction with only one concrete implementation | **YAGNI** | Wait for the third implementation before abstracting |
| The same concept called different names in different layers | **Ubiquitous Language** | One name, everywhere, agreed with domain experts |
| Function doing more than one thing (name contains "and") | **Extract Function** | One function, one job, one name |
| Function with four or more arguments | **Introduce Parameter Object** | Group into a named options/config object |
| Shallow pass-through module adding no abstraction value | Redesign as a **Deep Module** | Simple interface over rich hidden implementation |
| A design decision that makes the problem harder than the domain requires | **Eliminate accidental complexity** — redesign or delete | Only essential complexity should remain |
| Duplicate writes without idempotency key or upsert | **Idempotency** | Retry-safe by design |
| Read and write concerns sharing one model under load | **CQRS** | Separate read model from write model |
| Multiple services manually notified after a write | **Domain Event** + **Observer** | Emit event; consumers subscribe; producer is unaware |

### 7.3 Refactoring is always in scope

If a change is being made to a file, and that file contains an unrelated design smell — name it. Do not silently propagate a bad structure. Either fix it in the same PR (if the change is small) or open a follow-up and name the pattern it needs. A design debt named is a design debt scheduled.

---

### 7.4 The Boy Scout Rule — always leave it cleaner than you found it

"Leave the code cleaner than you found it." — Robert Martin (from Baden-Powell)

Every time you touch a file, make at least one small improvement beyond your task. It does not have to be a refactor. The cumulative effect of every developer making one small improvement per commit is a codebase that continuously improves — without cleanup sprints, without large disruptive diffs, without anyone declaring a "tech debt day."

**What qualifies:**
- Rename a variable or function to something more intention-revealing
- Add the pattern name as a comment where a pattern is applied
- Extract a two-line inline block into a named helper
- Delete a commented-out block
- Remove an unused import or variable
- Fix a vague error message to include the field and offending value
- Add a missing invariant comment

**What does NOT qualify:**
- A large refactor unrelated to the current task — that changes too much in one diff
- Behaviour changes disguised as cleanup
- Improvements in a file you are not already touching

**The constraint:** the improvement must be in a file you are already modifying, and must carry zero risk of behaviour change. If the improvement is larger — open a follow-up item and name it explicitly. Don't absorb it silently and don't skip it.

**The Boy Scout Rule and rule 7.3 are the same discipline stated differently.** Rule 7.3 says name the smell and schedule the fix. The Boy Scout Rule says fix the small ones immediately, in place. Together: nothing is left unnamed and nothing small is left unfixed.

---

## Part 8 — Pattern Catalog

This catalog is loaded into context. Use it as a lookup table when applying Part 7. Patterns marked ★ are already applied in the studio codebase and can be used as live examples.

---

### 8.1 GOF — Dispatch and variation

*Apply when behaviour varies by type, state, or context.*

| Pattern | Intent | Apply when | Studio instance |
|---|---|---|---|
| **Strategy** ★ | Encapsulate a family of algorithms; make them interchangeable | `if/else` on type in an orchestrator; each branch does something different | Each Op handler (`dsl`, `xOxComparer`, `chain`) is a Strategy |
| **Chain of Responsibility** ★ | Pass a request through handlers; first claimer handles it | Multiple handlers might own a request; the sender should not know which | `ops.resolve` iterates handlers; first `resolved:true` wins |
| **Template Method** ★ | Fix the algorithm skeleton; let collaborators fill in steps | Fixed sequence, variable per-step behaviour | `engine.run` walks steps → validate → execute; Ops fill in each verb |
| **Command** | Encapsulate a request as a storable, transmittable object | Queuing, undo, retry, or audit of operations | — |
| **State** | Change object behaviour when its state changes | Object has distinct lifecycle states; avoid `if (this.state === 'X')` inside methods | — |
| **Observer** | Notify dependents automatically when state changes | Parts of the system must react to a change without tight coupling | — |
| **Mediator** | Centralise how a set of objects interact | Many objects cross-communicating; wiring becomes unmanageable | — |
| **Visitor** ★ | Add operations to objects without changing their class | New operations on a stable structure; can't or won't modify existing classes | Ingredient visitors mutate the Query instance `q`; Recipe doesn't know about each ingredient |
| **Interpreter** | Define a grammar; evaluate sentences against it | A small domain language (rules, queries, expressions) needs parsing and evaluation | — |

---

### 8.2 GOF — Construction

*Apply when creation is complex, conditional, or expensive.*

| Pattern | Intent | Apply when | Studio instance |
|---|---|---|---|
| **Factory Method** ★ | Delegate creation to a method; caller doesn't know the exact type | Creation logic is conditional; the exact type should not be the caller's concern | `factory.create(input)` — caller passes intent, factory decides canonical shape |
| **Abstract Factory** | Create families of related objects through one interface | Multiple related factories must stay consistent (e.g. a theme that creates matching UI parts together) | — |
| **Builder** | Assemble a complex object step by step | Many optional fields or phases; construction separated from representation | — |
| **Prototype** | Clone an existing instance | Creating from scratch is expensive; a copy of an existing instance is sufficient | — |
| **Singleton** | One instance, globally accessible | Truly shared stateless services only. Prefer lazy factory: `const db = () => dbv4x.get(...)` | Lazy db handle is the preferred form |

---

### 8.3 GOF — Structure

*Apply when interfaces or object structures don't fit.*

| Pattern | Intent | Apply when | Studio instance |
|---|---|---|---|
| **Adapter** | Wrap an incompatible interface to match what callers expect | Integrating a third-party library or legacy system whose interface you cannot change | — |
| **Facade** ★ | Simple interface to a complex subsystem | Subsystem exposes too much to callers; hide it behind one entry point | `core/<entity>/index.js` is a Facade over factory + spec + repo |
| **Decorator** | Attach additional behaviour without subclassing | Cross-cutting concerns: logging, caching, auth, metrics — each wraps transparently | — |
| **Composite** ★ | Treat individual objects and compositions uniformly | Recursive structure; leaf and branch used the same way by callers | Plan is a Composite of Steps; the future `recipe` Op recurses into a nested Plan |
| **Proxy** | Surrogate with the same interface | Lazy loading, access control, or caching the caller should not know about | — |
| **Bridge** | Decouple abstraction from implementation so both vary independently | Two orthogonal dimensions of variation; inheriting both causes a class explosion | — |
| **Flyweight** | Share common state across many small objects | Many similar objects cause memory pressure; shared intrinsic state reduces it | — |

---

### 8.4 GOF — Finding, matching, and infrastructure

| Pattern | Intent | Apply when | Studio instance |
|---|---|---|---|
| **Specification** ★ | Encapsulate a business rule as a composable predicate | Same condition checked in multiple places; rules need to be combined (AND, OR, NOT) | `op.resolve(payload)` is a Specification; each Op's `resolve` is the predicate |
| **Registry** ★ | Central lookup of named objects or services | Objects need to be found by name/type without hard-coding references everywhere | `ops/index.js` — auto-discovers and exposes `route(operation)` |
| **Null Object** ★ | Default do-nothing (or loud-fail) implementation of an interface | Callers should not need to check for null; a Null Object absorbs or loudly rejects calls | `iOp.js` defaults throw on call — a "loud Null Object" that makes missing implementations immediately visible |

---

### 8.5 Fowler — Data access (PoEAA)

| Pattern | Intent | Apply when | Studio instance |
|---|---|---|---|
| **Repository** ★ | Abstract a collection of domain objects; hide all storage details | The domain must not know whether it talks to a DB, cache, or API | Every `repo.js` is a Repository |
| **Data Mapper** ★ | Translate between domain objects and storage rows; neither knows about the other | Domain objects must not contain persistence logic; rows must not contain domain logic | `serialiser.map / serialiser.unmap` |
| **Query Object** ★ | Represent a query as a composable object | Complex query conditions built incrementally by multiple parties; no string concatenation | The `q` (Query instance) mutated by ingredient visitors |
| **Unit of Work** | Track objects changed in a transaction; commit all at once | Multiple objects modified in one operation; partial commits must be prevented | — |
| **Identity Map** | One object per row per request | Prevent duplicate in-memory objects for the same database row | — |

---

### 8.6 Fowler — Domain model (DDD)

| Pattern | Intent | Apply when | Studio instance |
|---|---|---|---|
| **Entity** ★ | Identity by key; mutable; has a lifecycle | The object can change and must be found by a stable identifier | `Recipe` (keyed by `uuid`) |
| **Value Object** ★ | Immutable; equality by value; no identity | Represents a measurement, description, or coordinate; replace with a new instance, never mutate | `plan.make()` / `plan.append()` return new Plans — Plans are Value Objects |
| **Aggregate** | Cluster of Entities + Value Objects with a single root | A group must change together transactionally; the root is the only public entry point | — |
| **Domain Event** | Record that something of significance happened | Other parts of the system react to a change; decouple producer from consumers | — |
| **Service Layer** ★ | Thin layer that sequences domain operations without containing business logic | Boundary between presentation and domain; each verb maps to one use case | `core/<entity>/index.js` |
| **Domain Model** | Rich object model: behaviour lives next to data | Business logic is complex; behaviour belongs on the object that owns the data | — |
| **Transaction Script** | One procedure per use case; simple top-down logic | Business logic is simple CRUD; a full Domain Model would be over-engineered | Choose this deliberately for simple resources |

---

### 8.7 Fowler — Integration (PoEAA)

| Pattern | Intent | Apply when | Studio instance |
|---|---|---|---|
| **Gateway** | Wrap access to an external system behind a clean interface | External APIs change; your domain is insulated at one translation point | — |
| **Plugin** ★ | Discover and load extension modules at startup by convention | System needs extension without modifying the core | `ops/index.js` scans `ops/<name>/` at startup — this is the Plugin pattern |

---

## Part 9 — Micro-Craft

Function-level and file-level rules from Robert Martin's *Clean Code*. These apply to any language.

### 9.1 Functions: small and do exactly one thing

A function does one thing. One thing means: if you can extract a sub-function from it with a name that is not a restatement of the function itself, it is doing more than one thing.

**Smell:** the function name contains "and" or "or". The function has multiple levels of abstraction in one body. You can't write a single-sentence description without "and".

```js
// BAD — does three things: validate, build, persist
const saveRecipe = async (input, user) => {
    if (!input.name) throw boom.badRequest('name required');
    const recipe = { name: input.name.trim(), type: input.type, tags: [] };
    return db().exec(SAVE, { recipe, user });
};

// GOOD — one thing each; names are verbs that say exactly what each does
const saveRecipe = async (input, user) => {
    const recipe = factory.create(input);   // build
    spec.isValid(recipe);                   // validate
    return repo.save(recipe, user);         // persist
};
```

**Size heuristic:** a function that fits on one screen without scrolling is the ceiling, not the target. Functions of 5–15 lines are easier to name, test, and reason about.

---

### 9.2 Arguments: fewer is always better

| Count | Name | Guidance |
|---|---|---|
| 0 | Niladic | Best. No input = no coupling to callers. |
| 1 | Monadic | Good. One clear input. |
| 2 | Dyadic | Acceptable when the two args are naturally ordered (`point(x, y)`, `repo.save(entity, user)`). |
| 3 | Triadic | Requires justification. |
| 4+ | Polyadic | **Banned.** Group into an options object or config struct. |

```js
// BAD — four args; order is arbitrary, forgettable, error-prone
createRecipe(name, type, tags, user);

// GOOD — intent object; self-documenting; order doesn't matter
createRecipe({ name, type, tags }, user);
```

**Boolean arguments are a special case.** `process(data, true)` where `true` means "skip validation" is a function doing two things with an invisible toggle. Name the two behaviours instead: `processRaw(data)` vs `process(data)`.

---

### 9.3 Comments: prefer self-documenting code; comment the why

A comment explaining *what* the code does means the code is not readable enough. The code should say what it does. Rename functions, extract helpers, name constants — until the code speaks for itself.

A comment explaining *why* — the business reason, the non-obvious constraint, the historical decision — is valuable and should be written.

```js
// BAD — explains what (the code already does this)
// loop through handlers and check if resolved
for (const handler of R.values(handlers)) { ... }

// GOOD — explains why (non-obvious; code cannot say this itself)
// Chain of Responsibility — first handler to return resolved:true wins.
// Registration order determines priority; overlap is a bug in one resolver.
for (const handler of R.values(handlers)) { ... }
```

**Good candidates for comments:**
- Pattern names (rule 7.3) — name the pattern where it lives
- Invariants the code cannot express directly
- Non-obvious constraints ("must run before X because Y")
- Intentional omissions ("no connector join at v1 — reserved for multi-step outer plans")
- Decisions that were debated and resolved ("chose MERGE over INSERT for idempotency")

**Bad candidates — the code should say it instead:**
- `// get the user` before `const user = getUser(ctx)`
- `// check if valid` before `spec.isValid(recipe)`
- Commented-out code — delete it; version control remembers

---

### 9.4 Error handling is a separate concern

Error handling should not obscure the happy path. Two rules:

1. **One try/catch at the function boundary.** If a function's happy-path logic is wrapped in a try/catch mid-flow, extract the error-prone section into its own function.
2. **Never return null; never pass null.** Return an empty array, a typed Result, or throw. A null return forces every caller to check — one missed check is a production incident.

```js
// BAD — error handling wrapped around happy path; logic is hard to follow
const run = async (recipe, ctx) => {
    try {
        const plan = planOf(recipe);
        if (!plan) return null;
        const steps = [];
        for (const step of plan.steps) {
            try {
                steps.push(await op.execute(step, ctx, priors));
            } catch (err) { return null; }
        }
        return steps;
    } catch (err) { return null; }
};

// GOOD — happy path is clean; errors bubble; boundary logs
const run = async (recipe, ctx) => {
    const p = planOf(recipe);
    plan.validate(p);                              // throws on invalid
    const steps = [];
    for (const step of p.steps) {
        const op = ops.route(step.operation);
        await op.validate(step, recipe);           // throws on bad args
        steps.push(await op.execute(step, ctx));
    }
    return steps;
};
```

---

### 9.5 Wrap third-party dependencies at the boundary

Never let a third-party library's types, exceptions, or API surface leak into your domain. Wrap it once, at one entry point.

- One place to swap the library
- One place to add logging, retry, or transformation
- Prevents third-party API design choices from polluting your domain vocabulary

```js
// BAD — boom is used directly in domain logic
//        → swapping boom requires touching every file that throws
spec.isValid = (recipe) => {
    if (!recipe.name) throw boom.badRequest('name required');
};

// In this codebase boom IS the vocabulary (it's the agreed error type for the edge)
// — but it is confined to spec.js and edge only; factory and repo never see it.
// That IS the wrapping: boom is a deliberate dependency in two layers; nowhere else.
```

The principle: know which dependencies you are accepting throughout the codebase, and which you are containing to one layer. Containment at a layer boundary is the wrapping.

---

### 9.6 CQS — Command Query Separation

Every method is either a **command** or a **query** — never both.

| Type | Does | Returns | Side effects |
|---|---|---|---|
| **Query** | Returns data | A value | None — safe to call any number of times |
| **Command** | Changes state | Void or a confirmation | Yes — state is mutated |

A method that both mutates state and returns the new state forces callers to accept the side effect just to read the data. It ties two concerns — reading and writing — into a single call that cannot be used for either purpose independently.

```js
// BAD — one method both mutates state and returns it
//        caller must trigger the side effect to get the value
const addIngredient = (name, body, raw) => {
    raw.value = buildUpdatedValue(name, body, raw);  // mutates
    return raw;                                       // and queries
};

// GOOD — command returns void; separate query reads the result
const addIngredient = (name, body, raw) => {        // command: mutates
    raw.value = buildUpdatedValue(name, body, raw);
    // no return
};
const getIngredients = (raw) => parseIngredients(raw.value);  // query: pure
```

**In practice — the clean-coder patterns are already CQS-compliant:**
- `spec.isValid(entity)` — query: returns `true` or throws; no mutation
- `factory.create(input)` — query: returns a new entity; no side effects
- `repo.save(entity, user)` — command: persists; returns void or an id
- `op.resolve(payload)` — query: pure predicate; no side effects (rule 2.2)
- `op.process(payload, q, envelope)` — command: mutates envelope; returns void

**CQS and CQRS:** CQS is the method-level rule. CQRS (Part 11.2) is the same principle applied at the service or system boundary — separate read models from write models. One is about method signatures; the other is about deployment topology. Both come from the same insight.

**The CQS test:** if you find yourself writing `const updated = doSomething(entity)` where `doSomething` also has a side effect — split it. The side effect is a command; `return updated` is a query. Name them separately.

---

## Part 10 — Complexity Management

Drawing from Fred Brooks' *No Silver Bullet*, John Ousterhout's *A Philosophy of Software Design*, and Robert Martin's package-level principles.

### 10.1 Essential vs accidental complexity

Fred Brooks drew this distinction in 1986. It remains the most important lens for evaluating design decisions.

**Essential complexity** is inherent in the problem itself. It cannot be eliminated — it is the irreducible difficulty of the domain. A recipe execution engine that supports multiple query shapes *must* handle multiple shapes. That variation is essential. No design choice removes it.

**Accidental complexity** is introduced by the implementation, the tools, or the design choices. It is not inherent in the problem — it is complexity *we added*. It can be eliminated by better design.

| | Essential | Accidental |
|---|---|---|
| **Source** | The problem domain | Our implementation choices |
| **Can be eliminated?** | No — it is the problem | Yes — with better design |
| **Response** | Manage it; model it faithfully | Eliminate it; don't apologise for it |
| **Example** | Multiple op types (dsl, xOx, chain) genuinely exist and behave differently | A centralized `detectOp` switch that must be edited for each new type — that is our addition, not the domain's requirement |

**The design question to ask on every decision:**
*Is this complexity essential (the domain requires it) or accidental (we introduced it)?*

If accidental — eliminate it. If essential — model it as cleanly as possible so the accidental complexity layered on top of it is minimal.

**Studio example:**
The *existence* of multiple op types is essential — the domain has DSL queries, xOx comparisons, and chain pipelines. They genuinely differ.
The *centralized switch* (`if chain … else if xox … else dsl`) was accidental — it was a design choice that made every new op type an edit to factory.js. The registry + self-declaring handlers eliminated that accidental complexity without changing the essential fact that multiple types exist.

**Most of what this skill targets is accidental complexity:**
- A function doing two things — accidental (we combined them)
- A module with a wide shallow interface — accidental (we didn't hide enough)
- Duplicated logic — accidental (we copied instead of extracting)
- A missing contract — accidental (we didn't define the boundary)
- A train wreck call chain — accidental (we exposed internals we could have hidden)

Essential complexity requires careful modelling. Accidental complexity requires deletion.

---

### 10.2 Complexity is the primary enemy — everything else is a strategy against it

All design rules in this skill are strategies for reducing complexity. Complexity has two sources (Ousterhout):

| Source | Meaning | Fix |
|---|---|---|
| **Dependencies** | Code cannot be understood or changed in isolation | Reduce coupling; enforce layer boundaries |
| **Obscurity** | Important information is not obvious from reading the code | Intention-revealing names; comments on why; invariants made explicit |

Complexity is not "hard to understand once." It is anything that makes the system harder to change — because change is where complexity costs money.

---

### 10.2 Deep modules over shallow modules

A **deep module** has a simple interface and a rich, hidden implementation. The interface hides a lot of complexity. It earns its place.

A **shallow module** has a complex interface relative to the functionality it provides. It does not hide much. It adds cognitive load without paying it back.

```
Deep module (worth having):
    Interface:   saveRecipe(input, user) → recipe
    Hides:       factory.create, spec.isValid, spec.isAllowed, repo.save, serialiser.map

Shallow module (a pass-through):
    Interface:   build(input), validateSync(e), validateAsync(e, ctx), persist(e, user)
    Hides:       nothing — caller still orchestrates the sequence, knows the types,
                 and handles each failure mode
```

The second interface is almost no abstraction — the caller has the same knowledge burden as if there were no module at all.

**Red flags for shallow modules:**
- Pass-through functions that do nothing except delegate
- Wrappers that add no logic, just rename
- Interfaces with more exported methods than lines of internal logic

---

### 10.3 Strategic vs tactical programming

**Tactical programming:** make it work. Add the minimum change to pass the test. Ignore structure. Every change is a local fix.

**Strategic programming:** make it work *and* invest a small amount in keeping the system easy to change. The investment per change is small (10–20% overhead) but compounds — each change leaves the codebase slightly better than it found it.

Tactical code is fast at first and slow forever. Strategic code is slightly slower at first and fast forever.

This skill is a strategic programming manual. Apply it under deadline pressure too — especially then, because deadline pressure is exactly when the most tactical code gets written and the most expensive debt accrues.

---

### 10.4 Package and module cohesion (Robert Martin)

Three principles govern what belongs together in a module or package:

| Principle | Rule | Applied as |
|---|---|---|
| **REP** — Reuse/Release Equivalence | The unit of reuse is the unit of release. Things deployed together belong together. | Don't split one concept across packages because the files are different types. |
| **CCP** — Common Closure Principle | Things that change for the same reason belong together. Things that change for different reasons belong apart. SRP applied to packages. | `factory + spec + repo` for one entity belong together — they all change when the entity changes. |
| **CRP** — Common Reuse Principle | Don't force users to depend on things they don't use. | Avoid god-packages exporting dozens of unrelated things; every import pulls the whole package. |

---

### 10.5 Package coupling (Robert Martin)

Three principles govern dependencies *between* packages:

| Principle | Rule | What it prevents |
|---|---|---|
| **ADP** — Acyclic Dependencies Principle | No cycles in the dependency graph. If A depends on B and B depends on A, neither can change independently. | Break cycles by introducing a shared interface or moving shared code to a third module. |
| **SDP** — Stable Dependencies Principle | Depend in the direction of stability. Stable (slow-to-change) modules should be depended on; unstable (fast-to-change) modules should do the depending. | Prevents a volatile module from dragging down a stable one. |
| **SAP** — Stable Abstractions Principle | Stable modules should be abstract. A module that is both stable and concrete is hard to extend without modification. | Prevents stable modules from becoming OCP violations at the package level. |

---

## Part 11 — Distributed and Event-Driven

### 11.1 Idempotency — safe to call more than once

An operation is **idempotent** if performing it multiple times produces the same result as performing it once. Design every write operation to be idempotent because:
- Callers retry on timeout (did it succeed before the timeout fired?)
- Message queues deliver at-least-once (you may process the same message twice)
- Network partitions cause duplicate requests

**How to achieve it:**
- Use upsert (`MERGE`) instead of insert (`CREATE`) where possible
- Accept a **caller-supplied idempotency key** (a UUID the caller generates) and de-duplicate on it
- Make writes conditional: "only update if current state is X"

```js
// BAD — CREATE always creates; retry creates a duplicate
await db().exec('CREATE (r:Recipe {uuid: $uuid}) SET r += $props', { uuid: newId(), ...props });

// GOOD — MERGE is idempotent; safe to call multiple times with the same caller-supplied uuid
await db().exec('MERGE (r:Recipe {uuid: $uuid}) ON CREATE SET r += $props', { uuid: callerUuid, ...props });
```

---

### 11.2 CQRS — separate read model from write model

Commands (writes) change state. Queries (reads) return data. **Separate them.**

Read access patterns and write access patterns diverge as systems grow. Reads need denormalised, pre-joined, fast data. Writes need consistency and validation. A single model trying to satisfy both is mediocre at both.

**Applied lightly (no event sourcing required):**
- Write side: `factory → spec → repo.write` — same as today
- Read side: dedicated `repo.read` methods returning view-shaped data — potentially from a different query, index, or even a different store

**Applied fully (with event sourcing):**
- Write side emits domain events
- Read projections rebuild the read model from the event log
- The two models are physically separate and updated asynchronously

At the studio scale, CQRS applies lightly: `repo.save/update/archive` is the command side; `repo.get/list` is the query side. They can diverge as read needs grow without touching the write side.

---

### 11.3 Domain Events and eventual consistency

A **Domain Event** records that something of significance happened. Named in the past tense: `RecipeCreated`, `RecipeArchived`, `IngredientAdded`. It is a fact — immutable, timestamped.

Consumers subscribe to events and react asynchronously. The producer emits and forgets. Producer and consumer are decoupled in time and in deployment.

**Eventual consistency:** when two services share data via domain events, they are eventually consistent — not immediately. Design accordingly:
- A consumer processing `RecipeArchived` may lag behind the producer
- Do not assume a consumer has seen an event the moment the command completes
- Surface the eventual nature to users when it matters; hide it when it doesn't (most of the time it doesn't)

**Outbox pattern:** guarantees an event is published even if the process crashes after writing to the database but before publishing to the bus:
1. Write the entity change **and** the unpublished event to the same database transaction
2. A separate process reads unpublished events and publishes them
3. Mark as published after successful delivery

This makes event publishing atomic with the write — no lost events, no dual-write inconsistency.

---

### 11.4 Idempotent consumers

At-least-once delivery means your consumer must handle duplicate events. Two strategies:

- **Natural idempotency** — the operation is a no-op on repeat (e.g. `SET r.archived = true` is safe to run twice)
- **Idempotency key** — record each event's ID after processing; skip if already seen

Always design consumers to be idempotent. Assume duplicates will arrive.

---

## Enforcement — making the rules self-enforcing

Rules in a document are guidelines. Rules embedded in the system are constraints. The goal is to make violation immediately visible — ideally impossible.

| Rule | Self-enforcing mechanism |
|---|---|
| Layer boundaries | Directory structure mirrors layers. Cross-layer `require()` / `import` is visible in every diff and catchable by grep or lint. |
| Contract completeness | Interface defaults throw on first call. Missing method = runtime error, not silent wrong result. |
| TypeScript contracts | Missing method or wrong argument type is a build error — caught before the process starts, not at runtime. |
| Encapsulation | Narrow surface test: list all exports in one line. Internal helpers not in that list must not be exported. Layer crossings must not carry internal representations — map to a boundary type. |
| Two-verb split | Framework owns the transition line. Neither caller nor implementer can produce the stamped result without both verbs firing. |
| Open/closed | The central switch no longer exists. There is no file to edit when adding a handler. |
| Auto-discovery | Convention replaces registration. A correctly-shaped file in the right folder is the registration. |
| DRY | Single-authoritative-location test: if a change requires editing two files for one piece of knowledge, duplication is present. Apply during review, not after. |
| Validation gates | `plan.validate()` and `op.validate()` run unconditionally. The engine has no execution path that skips them. |
| Canonical output | `result.make()` is the only constructor. An Op returning the wrong shape produces `undefined` at the consumer — failure is immediately observable. |
| Intention-revealing names | Name review: if you need to read the body to understand the name, rename before merging. |
| Tell Don't Ask | If a block queries an object's state and then calls a method on the same object, the block belongs inside the object. |
| Law of Demeter | Count the dots in a call chain. More than one dot crossing object boundaries is a coupling smell. |
| YAGNI | Count concrete implementations. One → inline. Two → note it. Three → abstract. Not before. |
| Ubiquitous Language | Every concept has one name. Grep for synonyms across layers — if found, resolve before merging. |
| Hexagonal Architecture | Domain testable without adapters. `factory.js` + `spec.js` must have zero I/O imports. |
| Persisted identity | Shape is written to the database. A missing `shape` field on an entity is a data integrity failure visible before any code runs. |
| Greenfield discipline | The old path is deleted. A developer reading the code cannot accidentally follow a deleted path. |
| Module depth | Pass-through functions flagged in review. A wrapper that adds no logic is a shallow module. |
| Idempotency | All writes use upsert or idempotency key. `CREATE` without de-duplication is a bug waiting to happen. |

---

## Checklist — gate before approving any design

**Layers**
- [ ] Are all layers named, each with exactly one job stated in four words or fewer?
- [ ] Are the prohibited imports per layer written down and enforceable (grep / lint)?
- [ ] Do dependencies flow downward only? Any upward arrow identified and eliminated?

**Contracts**
- [ ] Does every layer boundary have an explicit contract file?
- [ ] Do all unimplemented contract methods throw immediately (not return null / undefined)?
- [ ] Is this a greenfield project? If yes, are contracts defined as TypeScript `interface` declarations?
- [ ] Is decision separated from action (two-verb rule) at every dispatch point?
- [ ] Are pure predicates free of side effects, logging, and throws?
- [ ] Is every module's public surface the minimum necessary? Can you list all exports in one line?
- [ ] Is internal state hidden — never exposed as raw mutable references?
- [ ] Does nothing cross a layer boundary carrying its internal representation? (map to a boundary type at the crossing)
- [ ] Do Op-private or module-private keys/fields stay private — only the writer reads them?
- [ ] **LSP:** is every contract implementer fully substitutable? Any `instanceof` check in a caller is an LSP violation.
- [ ] **ISP:** does each caller depend only on the methods it uses? If not, split the interface.
- [ ] **Composition:** is behavior composed rather than inherited? Any class hierarchy → replace with interface + composition.

**Extension**
- [ ] Can a new handler be added without editing the orchestrator, factory, engine, or registry?
- [ ] Does the registry auto-discover, or is there a manual registration list to maintain?
- [ ] Does each handler own its resolution predicate, its defaults, and its private state?
- [ ] Is there any `if (type === 'X')` or `switch (type)` in the orchestrator? → strategy pattern violation
- [ ] For every piece of knowledge (field list, enum, rule, default, shape): is there exactly one authoritative location? If a change requires editing two files, duplication exists.

**Vocabulary**
- [ ] Are author vocabulary and engine vocabulary named and documented separately?
- [ ] Is there a single bridge function that converts between them, at a defined moment?
- [ ] Are invariants written as one-line statements (not prose guidelines)?
- [ ] Is the proposed new concept genuinely new, or a variation composition already handles?
- [ ] Does every name reveal purpose, not mechanism? Apply the three tests: (1) readable without the body; (2) still correct if implementation changes; (3) written from the caller's point of view.

**Validity**
- [ ] Does validation occur at every boundary — not just the top?
- [ ] Do all error messages name the field, the rule, and the offending value?
- [ ] Is the canonical output shape defined in one place?
- [ ] Are sync checks run before async checks?

**Operations**
- [ ] Is entity identity persisted, not re-derived at runtime?
- [ ] Are soft-delete and audit fields present and stamped by the persistence layer?
- [ ] If the old design is wrong: is it deleted, not shimmed?

**Micro-Craft (Part 9)**
- [ ] Do all functions do exactly one thing? Can you name each in a single verb phrase without "and"?
- [ ] Do all functions have three or fewer arguments? Four+ → options object.
- [ ] Do comments explain *why*, not *what*? Is commented-out code deleted?
- [ ] Is error handling separated from the happy path? Does any function return null?
- [ ] Are third-party dependencies wrapped at the layer boundary — not scattered through domain code?
- [ ] **CQS:** is every method either a command (mutates, returns void) or a query (returns data, no side effects)? Never both.
- [ ] **Boy Scout:** does every touched file leave with at least one small improvement beyond the task?

**Complexity (Part 10)**
- [ ] For every piece of complexity in the design: is it essential (the domain requires it) or accidental (we introduced it)? Accidental complexity must be eliminated, not managed.
- [ ] Is every module deep (simple interface, rich implementation) rather than shallow (pass-through)?
- [ ] Are things that change together kept together (CCP)? Things that change independently, kept apart?
- [ ] Is there a cycle in the dependency graph? (A depends on B, B depends on A) → break it.
- [ ] Does each abstraction have at least three concrete implementations justifying it (YAGNI test)?
- [ ] Is one name used for each domain concept, everywhere (Ubiquitous Language)?
- [ ] Is each bounded context explicit? Do cross-context dependencies go through a translator (ACL)?

**Distributed (Part 11)**
- [ ] Are all write operations idempotent (upsert / idempotency key)?
- [ ] Are command (write) and query (read) paths separated?
- [ ] If events are used: are consumers idempotent? Is there an outbox or equivalent guarantee?

**Patterns (Part 7–8)**
- [ ] Has the smell → pattern table (§7.2) been scanned against this design?
- [ ] Is every `if/else` or `switch` on type in an orchestrator replaced with Strategy?
- [ ] Is every fixed sequence with variable steps expressed as Template Method?
- [ ] Are cross-cutting concerns (log, cache, auth) applied as Decorators rather than inline?
- [ ] Is every layer boundary that abstracts storage modelled as a Repository?
- [ ] Are translation layers between domain objects and storage rows explicit Data Mappers?
- [ ] Are composable predicates / business rules encapsulated as Specifications?
- [ ] Are Entities (identity by key) and Value Objects (equality by value, immutable) distinguished?
- [ ] Are external system calls isolated behind a Gateway?
- [ ] For every named pattern applied: is the pattern name written in a comment or design doc so the next developer knows why the structure is what it is?
