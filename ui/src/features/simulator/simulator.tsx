'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    ShieldCheck, ArrowLeft,
    Radio, Rss, CheckCircle2, XCircle, Zap, Shuffle,
} from 'lucide-react';
import { operational, CreateSignalInput } from '@/lib/api';

// ── Config ─────────────────────────────────────────────────────────────────────

const SIGNAL_TYPES = [
    'fire-alarm-trip',
    'unauthorized-access',
    'temperature-excursion',
    'pressure-anomaly',
    'equipment-fault',
    'unplanned-shutdown',
];

type Tab = 'signals' | 'feeds';

type Asset = { id: string; name: string; category?: string; assetType?: string; facilityId?: string };

type SignalResult = { signal: any; task: any };
type FiredSignal = SignalResult & { firedAt: string };

// ── Result dialog ──────────────────────────────────────────────────────────────

function ResultDialog({ result, error, onClose }: {
    result: SignalResult | null;
    error: string | null;
    onClose: () => void;
}) {
    if (!result && !error) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-zinc-950/70" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl p-5 flex flex-col gap-4">
                {error ? (
                    <>
                        <div className="flex items-center gap-2">
                            <XCircle size={18} className="text-red-400" />
                            <p className="text-sm font-semibold text-zinc-100">Signal rejected</p>
                        </div>
                        <p className="text-xs text-zinc-400">{error}</p>
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 size={18} className="text-emerald-400" />
                            <p className="text-sm font-semibold text-zinc-100">Signal posted</p>
                        </div>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 flex flex-col gap-1">
                            <p className="text-[11px] font-mono text-zinc-500">{result!.signal?.id}</p>
                            <p className="text-xs text-zinc-300">{result!.signal?.type} on {result!.signal?.assetId}</p>
                            {result!.task && (
                                <p className="text-xs text-zinc-500 mt-1">
                                    Auto-created task: <span className="text-zinc-300">{result!.task.name}</span>
                                    {result!.task.controlIds?.length > 0 && (
                                        <> — {result!.task.controlIds.length} control(s) matched</>
                                    )}
                                </p>
                            )}
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            Nothing else happens automatically from here — <span className="text-zinc-200">signal-intelligence</span> polls
                            the graph on its own schedule (every <code className="text-zinc-300">AGENT_POLL_INTERVAL_MS</code>, 60s by
                            default) and will pick this signal up on its next cycle, reason about it, and write a{' '}
                            <span className="text-zinc-200">Decision</span> — it does not react instantly.
                        </p>
                        <p className="text-xs text-zinc-500">
                            Wait about a minute, then check <span className="text-zinc-300">Intelligence</span> for a new
                            &quot;deviation-assessment&quot; card to review and approve.
                        </p>
                    </>
                )}
                <div className="flex items-center justify-end gap-3 pt-1">
                    <button onClick={onClose} className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
                        Close
                    </button>
                    {!error && (
                        <Link
                            href="/intelligence"
                            className="text-xs px-3 py-1.5 rounded-md bg-emerald-500 text-zinc-950 font-medium hover:bg-emerald-400 transition-colors"
                        >
                            Go to Intelligence →
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Signals tab ────────────────────────────────────────────────────────────────

function SignalsTab() {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loadingAssets, setLoadingAssets] = useState(true);
    const [assetId, setAssetId] = useState('');
    const [type, setType] = useState(SIGNAL_TYPES[0]);
    const [payload, setPayload] = useState('');
    const [firing, setFiring] = useState(false);
    const [result, setResult] = useState<SignalResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<FiredSignal[]>([]);

    useEffect(() => {
        operational.assets()
            .then((r: any) => {
                const raw = Array.isArray(r?.assets) ? r.assets : [];
                const list: Asset[] = raw.map((row: any) => row?.asset ?? row).filter(Boolean);
                setAssets(list);
                if (list.length > 0) setAssetId(list[0].id);
            })
            .catch(() => setAssets([]))
            .finally(() => setLoadingAssets(false));
    }, []);

    const selectedAsset = useMemo(() => assets.find(a => a.id === assetId), [assets, assetId]);

    const fire = async (overrideAssetId?: string, overrideType?: string) => {
        const chosenAssetId = overrideAssetId ?? assetId;
        const chosenType = overrideType ?? type;
        if (!chosenAssetId) return;
        setFiring(true);
        setError(null);
        const input: CreateSignalInput = {
            id: `SIG-SIM-${Date.now()}`,
            assetId: chosenAssetId,
            type: chosenType,
            source: 'simulator',
            payload: payload || undefined,
        };
        try {
            const res = await operational.createSignal(input);
            setResult(res);
            setHistory(h => [{ firedAt: new Date().toISOString(), ...res }, ...h].slice(0, 8));
        } catch (err: any) {
            setError(err.message || 'Signal was rejected by the API');
        } finally {
            setFiring(false);
        }
    };

    const fireRandom = () => {
        if (assets.length === 0) return;
        const randomAsset = assets[Math.floor(Math.random() * assets.length)];
        const randomType = SIGNAL_TYPES[Math.floor(Math.random() * SIGNAL_TYPES.length)];
        setAssetId(randomAsset.id);
        setType(randomType);
        fire(randomAsset.id, randomType);
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                    <Radio size={13} className="text-zinc-500" />
                    <p className="text-sm font-medium text-zinc-200">Post a live floor signal</p>
                </div>
                <p className="text-xs text-zinc-500 -mt-2">
                    Calls the real <code className="text-zinc-400">POST /operational/signals</code> endpoint — the same
                    write path IoT devices would use. This is the only agent trigger with a live API today; it
                    auto-creates a Task and, on the next agent poll, gives <span className="text-zinc-300">signal-intelligence</span> something
                    to reason about.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1">
                        <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Asset</span>
                        <select
                            value={assetId}
                            onChange={e => setAssetId(e.target.value)}
                            disabled={loadingAssets || assets.length === 0}
                            className="rounded-md border border-zinc-700 bg-zinc-950 text-zinc-200 text-sm px-3 py-2 disabled:opacity-50"
                        >
                            {loadingAssets && <option>Loading assets…</option>}
                            {!loadingAssets && assets.length === 0 && <option>No assets found</option>}
                            {assets.map(a => (
                                <option key={a.id} value={a.id}>
                                    {a.name} ({a.id}){a.category ? ` — ${a.category}` : ''}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Signal type</span>
                        <select
                            value={type}
                            onChange={e => setType(e.target.value)}
                            className="rounded-md border border-zinc-700 bg-zinc-950 text-zinc-200 text-sm px-3 py-2"
                        >
                            {SIGNAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </label>
                </div>

                <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Payload (optional)</span>
                    <input
                        value={payload}
                        onChange={e => setPayload(e.target.value)}
                        placeholder="e.g. sensor reading, free text — stored as-is on the Signal node"
                        className="rounded-md border border-zinc-700 bg-zinc-950 text-zinc-200 text-sm px-3 py-2 placeholder:text-zinc-600"
                    />
                </label>

                {selectedAsset?.category && (
                    <p className="text-[11px] text-zinc-600">
                        {selectedAsset.name} is in the <span className="text-zinc-400">{selectedAsset.category}</span> compliance
                        area — if it has no matching Control, the auto-created Task will have zero matched controls
                        (a real, documented coverage gap, not a bug).
                    </p>
                )}

                <div className="flex items-center gap-3 pt-1">
                    <button
                        onClick={() => fire()}
                        disabled={firing || !assetId}
                        className="flex items-center gap-2 text-xs px-4 py-2 rounded-md bg-emerald-500 text-zinc-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50"
                    >
                        <Zap size={13} /> {firing ? 'Posting…' : 'Fire signal'}
                    </button>
                    <button
                        onClick={fireRandom}
                        disabled={firing || assets.length === 0}
                        className="flex items-center gap-2 text-xs px-4 py-2 rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                        <Shuffle size={13} /> Surprise me
                    </button>
                </div>
            </div>

            {history.length > 0 && (
                <div className="flex flex-col gap-3">
                    <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                        Simulated this session · {history.length}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {history.map((h, i) => (
                            <div key={h.signal?.id ?? i} className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 flex flex-col gap-1">
                                <p className="text-[11px] font-mono text-zinc-500">{h.signal?.id}</p>
                                <p className="text-xs text-zinc-300">{h.signal?.type} on {h.signal?.assetId}</p>
                                <p className="text-[10px] text-zinc-600">{new Date(h.firedAt).toLocaleTimeString()}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <ResultDialog result={result} error={error} onClose={() => { setResult(null); setError(null); }} />
        </div>
    );
}

// ── Feeds tab (stub — no live trigger exists yet) ───────────────────────────────

function FeedsTab() {
    return (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-6 flex flex-col gap-4 max-w-2xl">
            <div className="flex items-center gap-2">
                <Rss size={13} className="text-zinc-500" />
                <p className="text-sm font-medium text-zinc-300">Feeds</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-500">not live yet</span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
                Regulatory/enterprise feeds and new Incidents are what <span className="text-zinc-300">control-intelligence</span> and{' '}
                <span className="text-zinc-300">assurance-intelligence</span> watch for — uncontrolled Requirements and
                Incidents with unbundled Evidence, respectively. Unlike Signals, there is no live API write path for
                these yet: <code className="text-zinc-400">Requirement</code>, <code className="text-zinc-400">Incident</code>,
                and <code className="text-zinc-400">Evidence</code> are seeded only by the CLI ingestion pipeline, so
                there's nothing this simulator can honestly call.
            </p>
            <p className="text-xs text-amber-400/90 leading-relaxed">
                Re-running ingestion is <span className="font-medium">not</span> a way to trigger these two agents.
                Every loader uses Cypher <code className="text-amber-300">MERGE</code>, so re-running it against the
                same seed CSVs writes zero new nodes — both agents already saw everything reachable in this seed on
                their very first poll. It only produces something new for them to react to if the underlying CSV
                rows themselves change first (a new Requirement with no Control, a new Incident with fresh Evidence)
                — that&apos;s a data-engineering edit, not something to click here.
            </p>
            <p className="text-xs text-zinc-500">To re-seed the graph from scratch (e.g. after wiping the database):</p>
            <pre className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-[11px] text-zinc-400 overflow-x-auto">
{`./ingest.sh                       # local dev
docker compose run --rm ingest    # Docker`}
            </pre>
        </div>
    );
}

// ── Main view ──────────────────────────────────────────────────────────────────

export function SimulatorView() {
    const [tab, setTab] = useState<Tab>('signals');

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-zinc-950 text-zinc-100">

            {/* ── Header ── */}
            <header className="border-b border-zinc-800/60 shrink-0">
                <div className="flex items-center justify-between px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
                            <ShieldCheck size={18} className="text-zinc-950" />
                        </div>
                        <div>
                            <p className="text-base font-semibold leading-tight">VYRA</p>
                            <p className="text-xs text-zinc-500 leading-tight">Simulator — trigger agents without a terminal</p>
                        </div>
                    </div>
                    <Link href="/" className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
                        <ArrowLeft size={13} /> Landscape
                    </Link>
                </div>
            </header>

            {/* ── Tabs ── */}
            <div className="px-6 pt-4 flex items-center gap-1 shrink-0">
                {([
                    { key: 'signals', label: 'Signals', icon: Radio },
                    { key: 'feeds', label: 'Feeds', icon: Rss },
                ] as const).map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-t-md border-b-2 transition-colors ${
                            tab === key
                                ? 'border-emerald-500 text-zinc-100'
                                : 'border-transparent text-zinc-500 hover:text-zinc-300'
                        }`}
                    >
                        <Icon size={12} /> {label}
                    </button>
                ))}
            </div>

            {/* ── Content ── */}
            <div className="flex-1 min-h-0 overflow-auto px-6 py-4">
                {tab === 'signals' ? <SignalsTab /> : <FeedsTab />}
            </div>

            {/* ── Footer ── */}
            <footer className="border-t border-zinc-800/60 px-6 py-2.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-emerald-500 flex items-center justify-center">
                        <ShieldCheck size={9} className="text-zinc-950" />
                    </div>
                    <span className="text-[10px] text-zinc-600">Vyra Platform v1</span>
                </div>
                <p className="text-[10px] text-zinc-700">Compliance. Handled.</p>
            </footer>
        </div>
    );
}
