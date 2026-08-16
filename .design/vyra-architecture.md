# Vyra Architecture

**The platform's layers and components — how Vyra is built.** Where `vyra-graph-spine.md` is the ground truth for *what* Vyra stores (the graph model), this document is the ground truth for *how the software is layered around it*: the runtime components, who talks to whom, and the access rules that keep the layers honest.

> Companion docs: `vyra-landscape.md` (vision + operating model), `vyra-graph-spine.md` (the graph schema this architecture serves), `vyra-implementation-plan.md` (sequencing + build status).

---

## Orientation

Vyra is a monorepo of five workspaces layered around a single **Compliance Digital Twin** (one Neo4j graph per enterprise). The layers form a strict stack: the UI reads only through the API, every component reaches the graph only through one shared data-access module, and the graph is the sole point of integration — components collaborate *through the graph*, never by calling each other directly.

The platform meets the outside world at **two edges**, with the application layers between them and its **external service dependencies** on the right:
- **Presentation edge (top)** — the human-facing boundary: the web UI, spanning the top.
- **Integration edge (left)** — the machine-facing boundary: IoT services (live floor signals), feeds (catalog + enterprise seed data), and integration APIs for third-party systems.
- **Application layers (center)** — the API/Service and Ingestion write paths and the shared `lib/graph-db` foundation, with the **Agent Runtime** on the right within the same band.
- **External services (right)** — stacked to the right of the app layers: the agents reason against a **local Ollama LLM** (no API key, no cloud dependency — runs on the same machine); identity/SSO and notifications are planned integrations, not yet built.

Two write paths feed the twin, and they are deliberately different in character:
- **Batch ingestion** (`cli/`) — CSV → Neo4j `LOAD CSV`, run on demand to seed and re-sync the catalog and enterprise context.
- **Live runtime** (`api/`, `agents/`) — direct, per-event graph writes for operational signals and agent recommendations.

Everything below the API — the agent runtime, the ingestion pipeline, the API itself — funnels through **`lib/graph-db`**, the only module that holds a Neo4j driver handle.

---

## Layers at a Glance

| Layer | Workspace | Port | Components | Talks to |
|---|---|---|---|---|
| **Presentation** | `ui/` | 3002 | Next.js + React feature views — `landscape`, `dashboard`, `knowledge`, `execution`, `intelligence`, `assurance`, `calendar`, `validation` | API (HTTP) only — **never** Neo4j |
| **API / Service** | `api/` | 4001 | Fastify; domain modules — `knowledge`, `execution`, `operational`, `intelligence`, `assurance`, `catalog`, `enterprise`, `dashboard` | `lib/graph-db` |
| **Agent Runtime** | `agents/` | — | `runtime` (observe→reason→act→verify loop + `reasonWithLLM` helper), `tools` (graph-read / graph-write), agent families — `control-intelligence` (live), `risk-`/`signal-`/`assurance-intelligence` (stubs) | `lib/graph-db` + local Ollama (`localhost:11434`) — **never** the API |
| **Ingestion** | `cli/` | — | Pipeline: `parser` → `compiler` → `projection` → `runtime`; orchestrators `index.ts` / `catalog-sync.ts` / `enterprise-sync.ts`; `semantic-contract/v2.ts` (column→node contract); `scripts/` (converters, backfill) | `lib/graph-db` (via `LOAD CSV`) |
| **Shared Foundation** | `lib/` | — | `graph-db` (sole Neo4j driver), `log`, `config` — **built before all others** | Neo4j |
| **Data / Graph** | Neo4j `agentic-grc` | — | The five-domain Compliance Digital Twin — see `vyra-graph-spine.md` | — |

**Access rules (the invariants):**
- The **UI never touches Neo4j** — all reads go through the API over HTTP.
- **`lib/graph-db` is the only door to Neo4j** — API, agents, and CLI all go through it; nothing else holds a driver.
- **Agents never call the API**, and the API never calls agents — they meet only in the graph.
- **The graph is the integration bus** — a change lands in its owner's sub-graph and propagates through relationships (see `vyra-graph-spine.md` §3.3).

---

## The Layered Architecture

```mermaid
graph TB
    classDef ext     fill:#f5f5f4,stroke:#78716c,color:#292524,stroke-width:1.5px;
    classDef planned fill:#fafaf9,stroke:#a1a1aa,color:#3f3f46,stroke-dasharray:4 3;
    classDef ui      fill:#faf5ff,stroke:#7c3aed,color:#3b0764,stroke-width:1.5px;
    classDef api     fill:#eef2ff,stroke:#4f46e5,color:#1e1b4b,stroke-width:1.5px;
    classDef agent   fill:#fef2f2,stroke:#dc2626,color:#450a0a,stroke-width:1.5px;
    classDef cli     fill:#fefce8,stroke:#ca8a04,color:#422006,stroke-width:1.5px;
    classDef lib     fill:#ecfeff,stroke:#0891b2,color:#083344,stroke-width:2px;
    classDef data    fill:#f0fdf4,stroke:#16a34a,color:#052e16,stroke-width:2px;

    %% ═══════ TOP EDGE · presentation (spans left → right) ═══════
    subgraph EDGE_TOP["🖥️ EDGE · Presentation — ui/ · :3002"]
        direction LR
        UI[Next.js + React &nbsp;·&nbsp; landscape · dashboard · knowledge · execution · intelligence · assurance · calendar]:::ui
    end

    %% ═══════ LEFT EDGE · integration (top → bottom) ═══════
    subgraph EDGE_LEFT["📡 EDGE · Integration"]
        direction TB
        IOT[IoT Services<br/>live floor signals]:::ext
        FEED[Feeds<br/>catalog + enterprise CSVs]:::ext
        INTG[Integration API<br/>3rd-party systems]:::ext
    end

    %% ═══════ CENTER · application layers (core stack + agent on right) ═══════
    subgraph APP["APPLICATION LAYERS"]
        direction LR
        subgraph CORE["Service Stack"]
            direction TB
            API[🔌 API / Service — api/ · :4001<br/>knowledge · execution · operational · intelligence<br/>assurance · catalog · enterprise · dashboard]:::api
            CLI[⚙️ Ingestion — cli/<br/>parser → compiler → projection → runtime<br/>catalog-sync · enterprise-sync · v2.ts contract]:::cli
            LIB[🔑 Shared Foundation — lib/<br/>graph-db · log · config ▸ sole Neo4j driver]:::lib
        end
        AG[🤖 Agent Runtime — agents/<br/>observe→reason→act→verify<br/>tools: graph-read / graph-write<br/>control-intelligence · +stubs]:::agent
    end

    subgraph DATA["🗄️ DATA"]
        NEO[(Neo4j 'agentic-grc'<br/>Compliance Digital Twin — Knowledge · Operational<br/>Intelligence · Execution · Assurance)]:::data
    end

    %% ═══════ RIGHT · external services (top → bottom) ═══════
    subgraph EXT_SVC["🌐 External Services"]
        direction TB
        OLLAMA[Ollama · local LLM<br/>llama3.1:8b — localhost:11434]:::ext
        SSO[Identity / SSO<br/>planned]:::planned
        NOTIFY[Notifications / Alerting<br/>planned]:::planned
    end

    %% presentation edge → app
    UI -->|HTTP| API

    %% integration edge → app
    IOT -->|POST /operational/signals| API
    INTG --> API
    FEED --> CLI

    %% app + agent → single door → graph
    API --> LIB
    CLI --> LIB
    AG --> LIB
    LIB --> NEO

    %% agent → external services (AG is the rightmost app node, so the block hangs to the right;
    %% invisible links force the three services into a vertical column)
    AG -->|reason| OLLAMA
    OLLAMA ~~~ SSO
    SSO ~~~ NOTIFY
```

**Reading the diagram:**
- **Two edges, a central spine, and external services.** The **Presentation edge** spans the **top** (human boundary); the **Integration edge** runs down the **left** (machine boundary — IoT signals, seed feeds, third-party APIs); the **application layers** form the **center** — the core service stack (API → Ingestion → Foundation) top-to-bottom with the **Agent Runtime** to its right in the same band; and **External Services** stack vertically on the **right**.
- **Where each edge lands:** UI and third-party/IoT traffic enter through the **API**; seed feeds enter through **Ingestion**. Together with the agents, these are the write paths into the twin — none writes into another's territory; the graph carries the consequence forward.
- **`lib/graph-db` is the single door to Neo4j** — API, ingestion, and agents all pass through it; nothing else holds a driver.
- **Agents reason against a local Ollama LLM** (right) but persist only into the graph, under Autonomy Level 1 (propose, human approves). Ollama runs on the same machine — no API key, no outbound cloud call, unlike a hosted model provider. **Identity/SSO** and **Notifications** are drawn dashed — planned external integrations, not yet built.
