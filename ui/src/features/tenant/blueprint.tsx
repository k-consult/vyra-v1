'use client';

import { useEffect, useRef, useState } from 'react';
import { Layers, Plus, Trash2, ArrowUp, ArrowDown, Pencil, Check, X, Download, Upload } from 'lucide-react';
import { blueprint as blueprintApi, type BlueprintLevel, type BlueprintProperty, type TenantBlueprint, type PropertyDataType, type BlueprintExport } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { ConfirmDialog } from '@/components/dialog';
import { LoadingState, ErrorState, RefreshButton } from './shared';

const inputClass = 'bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600';
const DATA_TYPES: PropertyDataType[] = ['STRING', 'NUMBER', 'DECIMAL'];

// Mirrors lib/blueprint/ingest-key.ts's labelFromName and
// lib/blueprint/reserved.ts (the server's authoritative source) — duplicated
// here only for a badge/tooltip; the server enforces this regardless of what
// this UI shows. A Level has no ingestKey of its own, just a `name` — this is
// purely presentational (the label a structure upload would create here).
const labelFromName = (name: string): string =>
    name.trim().split(/\s+/).map(w => w.replace(/[^a-zA-Z0-9]/g, '')).filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
// Facility/Asset can't be *renamed away from* their label (server-enforced,
// badged here for information). Organisation/Facility/Asset additionally can
// never be *removed*, regardless of position — enforced server-side only, not
// reflected in the UI (no disabled button), per instruction: the remove
// button always fires and simply surfaces whatever the server rejects with.
const RESERVED_LABELS = new Set(['Facility', 'Asset']);

function IconButton({ title, onClick, disabled, children }: { title: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
    return (
        <button title={title} disabled={disabled} onClick={onClick} className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30">
            {children}
        </button>
    );
}

function AddLevelForm({ onAdded, onCancel }: { onAdded: () => void; onCancel?: () => void }) {
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const submit = () => {
        setSaving(true);
        setError(null);
        blueprintApi.addLevel({ name })
            .then(() => { setName(''); onAdded(); })
            .catch((err: any) => setError(err.message))
            .finally(() => setSaving(false));
    };

    return (
        <div className="flex items-center gap-2 pt-2">
            <input className={inputClass} placeholder="Level name (e.g. Zone)" value={name} onChange={e => setName(e.target.value)} />
            <button
                onClick={submit}
                disabled={saving || !name.trim()}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-zinc-300 border border-zinc-800 hover:border-zinc-700 disabled:opacity-40"
            >
                <Plus size={12} /> Add level
            </button>
            {onCancel && <button onClick={onCancel} className="text-[11px] text-zinc-500">Cancel</button>}
            {error && <span className="text-[11px] text-red-400">{error}</span>}
        </div>
    );
}

function AddChildLevelForm({ afterLevelId, onAdded, onCancel }: { afterLevelId: string; onAdded: () => void; onCancel: () => void }) {
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const submit = () => {
        setSaving(true);
        setError(null);
        blueprintApi.addLevel({ name, afterLevelId })
            .then(() => { setName(''); onAdded(); })
            .catch((err: any) => setError(err.message))
            .finally(() => setSaving(false));
    };

    return (
        <div className="flex items-center gap-2 pl-5 pb-2">
            <input className={inputClass} placeholder="Child level name" value={name} onChange={e => setName(e.target.value)} />
            <button
                onClick={submit}
                disabled={saving || !name.trim()}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-zinc-300 border border-zinc-800 hover:border-zinc-700 disabled:opacity-40"
            >
                <Plus size={10} /> Add
            </button>
            <button onClick={onCancel} className="text-[11px] text-zinc-500">Cancel</button>
            {error && <span className="text-[11px] text-red-400">{error}</span>}
        </div>
    );
}

function AddPropertyForm({ levelId, onAdded }: { levelId: string; onAdded: () => void }) {
    const [name, setName] = useState('');
    const [ingestKey, setIngestKey] = useState('');
    const [dataType, setDataType] = useState<PropertyDataType>('STRING');
    const [defaultValue, setDefaultValue] = useState('');
    const [required, setRequired] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const submit = () => {
        setSaving(true);
        setError(null);
        blueprintApi.addProperty(levelId, { name, ingestKey, dataType, defaultValue: defaultValue || undefined, required })
            .then(() => { setName(''); setIngestKey(''); setDataType('STRING'); setDefaultValue(''); setRequired(false); onAdded(); })
            .catch((err: any) => setError(err.message))
            .finally(() => setSaving(false));
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            <input className={inputClass} placeholder="Property name" value={name} onChange={e => setName(e.target.value)} />
            <input className={`${inputClass} font-mono`} placeholder="INGEST_KEY" value={ingestKey} onChange={e => setIngestKey(e.target.value.toUpperCase())} />
            <select className={inputClass} value={dataType} onChange={e => setDataType(e.target.value as PropertyDataType)}>
                {DATA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className={inputClass} placeholder="Default value" value={defaultValue} onChange={e => setDefaultValue(e.target.value)} />
            <label className="flex items-center gap-1 text-[11px] text-zinc-400">
                <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} />
                required
            </label>
            <button
                onClick={submit}
                disabled={saving || !name.trim() || !ingestKey.trim()}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-zinc-400 border border-zinc-800 hover:border-zinc-700 disabled:opacity-40"
            >
                <Plus size={10} /> Add property
            </button>
            {error && <span className="text-[11px] text-red-400">{error}</span>}
        </div>
    );
}

function PropertyRow({ property, onChanged }: { property: BlueprintProperty; onChanged: () => void }) {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(property.name);
    const [ingestKey, setIngestKey] = useState(property.ingestKey);
    const [dataType, setDataType] = useState<PropertyDataType>(property.dataType ?? 'STRING');
    const [defaultValue, setDefaultValue] = useState(property.defaultValue ?? '');
    const [required, setRequired] = useState(property.required ?? false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [removeError, setRemoveError] = useState<string | null>(null);

    // Fully editable, including ingestKey, on every property — even on
    // Organisation/Facility/Asset. structure-sync.ts resolves Facility/
    // Asset's code/name/category/assetType by a `role` carried on the
    // Property node itself, not by matching a literal ingestKey, so renaming
    // is always safe.
    const save = () => {
        setSaving(true);
        setError(null);
        blueprintApi.updateProperty(property.id, { name, ingestKey, dataType, defaultValue, required })
            .then(() => { setEditing(false); onChanged(); })
            .catch((err: any) => setError(err.message))
            .finally(() => setSaving(false));
    };

    const remove = () => {
        setRemoveError(null);
        blueprintApi.removeProperty(property.id).then(onChanged).catch((err: any) => setRemoveError(err.message));
    };

    if (editing) {
        return (
            <div className="flex flex-wrap items-center gap-2 pl-5">
                <input className={inputClass} value={name} onChange={e => setName(e.target.value)} />
                <input className={`${inputClass} font-mono`} value={ingestKey} onChange={e => setIngestKey(e.target.value.toUpperCase())} />
                <select className={inputClass} value={dataType} onChange={e => setDataType(e.target.value as PropertyDataType)}>
                    {DATA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input className={inputClass} placeholder="Default value" value={defaultValue} onChange={e => setDefaultValue(e.target.value)} />
                <label className="flex items-center gap-1 text-[11px] text-zinc-400">
                    <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} />
                    required
                </label>
                <IconButton title="Save" onClick={save} disabled={saving}><Check size={12} className="text-emerald-400" /></IconButton>
                <IconButton title="Cancel" onClick={() => setEditing(false)}><X size={12} className="text-zinc-500" /></IconButton>
                {error && <span className="text-[11px] text-red-400">{error}</span>}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 pl-5">
            <span className="text-xs text-zinc-300">{property.name}</span>
            <span className="text-[10px] font-mono text-zinc-600">{property.ingestKey}</span>
            <span className="text-[10px] text-zinc-500">{property.dataType ?? 'STRING'}</span>
            {property.required && <span className="text-[10px] text-amber-500/80 border border-amber-800/40 rounded px-1">required</span>}
            {property.defaultValue && <span className="text-[10px] text-zinc-500">default: {property.defaultValue}</span>}
            <IconButton title="Edit property" onClick={() => setEditing(true)}><Pencil size={10} className="text-zinc-500" /></IconButton>
            <IconButton title="Remove property" onClick={remove}><Trash2 size={10} className="text-zinc-600" /></IconButton>
            {removeError && <span className="text-[11px] text-red-400">{removeError}</span>}
        </div>
    );
}

function LevelNode({ level, levels, position, onChanged }: {
    level: BlueprintLevel;
    levels: BlueprintLevel[];
    position: number;
    onChanged: () => void;
}) {
    const [open, setOpen] = useState(true);
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(level.name);
    const [alias, setAlias] = useState(level.alias ?? '');
    const [description, setDescription] = useState(level.description ?? '');
    const [addingChild, setAddingChild] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [removeError, setRemoveError] = useState<string | null>(null);

    const label = labelFromName(level.name);
    const reserved = RESERVED_LABELS.has(label);
    const child = levels[position + 1];

    const save = () => {
        setSaving(true);
        setError(null);
        blueprintApi.updateLevel(level.id, { name, alias, description })
            .then(() => { setEditing(false); onChanged(); })
            .catch((err: any) => setError(err.message))
            .finally(() => setSaving(false));
    };

    const remove = () => {
        setRemoveError(null);
        blueprintApi.removeLevel(level.id).then(onChanged).catch((err: any) => setRemoveError(err.message));
    };

    return (
        <div className="flex flex-col gap-1.5">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
                <div className="flex items-center gap-2 px-3 py-2.5">
                    {editing ? (
                        <div className="flex flex-wrap items-center gap-2 flex-1">
                            <input
                                className={inputClass}
                                value={name}
                                title={reserved ? `"${label}" is a reserved label — renaming away from it isn't allowed` : undefined}
                                onChange={e => setName(e.target.value)}
                            />
                            <input className={inputClass} placeholder="alias" value={alias} onChange={e => setAlias(e.target.value)} />
                            <input className={inputClass} placeholder="description" value={description} onChange={e => setDescription(e.target.value)} />
                            <IconButton title="Save" onClick={save} disabled={saving}><Check size={12} className="text-emerald-400" /></IconButton>
                            <IconButton title="Cancel" onClick={() => setEditing(false)}><X size={12} className="text-zinc-500" /></IconButton>
                            {error && <span className="text-[11px] text-red-400">{error}</span>}
                        </div>
                    ) : (
                        <>
                            <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2 flex-1 text-left">
                                <Layers size={13} className="text-sky-400" />
                                <span className="text-sm text-zinc-200">{level.name}</span>
                                {level.alias && <span className="text-[10px] text-zinc-500">alias: {level.alias}</span>}
                                <span className="text-[10px] font-mono text-zinc-600">{label}</span>
                                {reserved && <span className="text-[10px] text-amber-500/80 border border-amber-800/40 rounded px-1">reserved</span>}
                                <span className="ml-auto text-[10px] text-zinc-500">{level.properties.length} propert{level.properties.length === 1 ? 'y' : 'ies'}</span>
                            </button>
                            <IconButton title="Edit level" onClick={() => setEditing(true)}><Pencil size={11} className="text-zinc-500" /></IconButton>
                            <IconButton
                                title="Move up" disabled={position === 0}
                                onClick={() => blueprintApi.get().then(({ blueprint }) => {
                                    const ids = blueprint.levels.map(l => l.id);
                                    [ids[position - 1], ids[position]] = [ids[position], ids[position - 1]];
                                    return blueprintApi.reorderLevels(ids);
                                }).then(onChanged)}
                            >
                                <ArrowUp size={11} className="text-zinc-500" />
                            </IconButton>
                            <IconButton
                                title="Move down" disabled={position === levels.length - 1}
                                onClick={() => blueprintApi.get().then(({ blueprint }) => {
                                    const ids = blueprint.levels.map(l => l.id);
                                    [ids[position], ids[position + 1]] = [ids[position + 1], ids[position]];
                                    return blueprintApi.reorderLevels(ids);
                                }).then(onChanged)}
                            >
                                <ArrowDown size={11} className="text-zinc-500" />
                            </IconButton>
                            <IconButton title="Remove level" onClick={remove}>
                                <Trash2 size={11} className="text-zinc-500" />
                            </IconButton>
                            {removeError && <span className="text-[11px] text-red-400">{removeError}</span>}
                        </>
                    )}
                </div>
                {open && !editing && (
                    <div className="border-t border-zinc-800 px-3 py-2.5 flex flex-col gap-2">
                        {level.properties.map(p => <PropertyRow key={p.id} property={p} onChanged={onChanged} />)}
                        <div className="pl-5">
                            <AddPropertyForm levelId={level.id} onAdded={onChanged} />
                        </div>
                        {addingChild ? (
                            <AddChildLevelForm afterLevelId={level.id} onAdded={() => { setAddingChild(false); onChanged(); }} onCancel={() => setAddingChild(false)} />
                        ) : (
                            <button onClick={() => setAddingChild(true)} className="flex items-center gap-1.5 self-start pl-5 text-[11px] text-zinc-500 hover:text-zinc-300">
                                <Plus size={11} /> {child ? 'Insert level below' : 'Add child level'}
                            </button>
                        )}
                    </div>
                )}
            </div>
            {child && (
                <div className="pl-6 ml-2 border-l border-zinc-800/60">
                    <LevelNode level={child} levels={levels} position={position + 1} onChanged={onChanged} />
                </div>
            )}
        </div>
    );
}

// Export downloads the current schema as portable JSON. Restore is a full,
// destructive replace — not a merge — so it always goes through a confirm
// step naming exactly what gets wiped: see api/modules/blueprint/repo.ts's
// restoreBlueprint for the authoritative list.
function ExportRestoreControls({ onRestored }: { onRestored: () => void }) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [pending, setPending] = useState<BlueprintExport | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);
    const [restoreError, setRestoreError] = useState<string | null>(null);
    const [restoring, setRestoring] = useState(false);

    const exportJson = () => {
        blueprintApi.export().then(data => {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'vyra-blueprint.json';
            a.click();
            URL.revokeObjectURL(url);
        });
    };

    const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setParseError(null);
        setRestoreError(null);
        file.text()
            .then(text => {
                const parsed = JSON.parse(text);
                if (!Array.isArray(parsed?.levels)) throw new Error('file does not look like a blueprint export (missing "levels" array)');
                setPending(parsed);
            })
            .catch((err: any) => setParseError(err.message));
    };

    const confirmRestore = () => {
        if (!pending) return;
        setRestoring(true);
        setRestoreError(null);
        blueprintApi.restore(pending.levels)
            .then(() => { setPending(null); onRestored(); })
            .catch((err: any) => setRestoreError(err.message))
            .finally(() => setRestoring(false));
    };

    return (
        <>
            <button
                title="Export this tenant's blueprint as JSON"
                onClick={exportJson}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
            >
                <Download size={12} /> Export
            </button>
            <button
                title="Restore from a blueprint JSON file — wipes the current org structure"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
            >
                <Upload size={12} /> Restore
            </button>
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={onFileSelected} />
            {parseError && <span className="text-[11px] text-red-400">{parseError}</span>}
            <ConfirmDialog
                open={!!pending}
                title="Restore blueprint from file?"
                danger
                busy={restoring}
                confirmLabel="Wipe and restore"
                message={
                    (restoreError ? `${restoreError} — ` : '') +
                    `This replaces the current structure schema and permanently deletes every real Organisation/Business Unit/Facility/Building/Floor/Area/Asset node under it, along with all Permit, Contract, Warranty, Signal, Vendor records and this tenant's own Task/Schedule entries. Obligation mappings and classifications tied to those assets are deleted with them. Catalog data (regulations, obligations, controls, and catalog-sourced Task/Schedule templates) is never touched. This cannot be undone.`
                }
                onConfirm={confirmRestore}
                onCancel={() => { setPending(null); setRestoreError(null); }}
            />
        </>
    );
}

// The tree editor itself, with no page chrome of its own — shared between the
// standalone /tenant/blueprint route (TenantBlueprintView, below) and
// Onboarding's "Blueprint" stage (onboarding.tsx), which is now the first
// step in the wizard rather than this having its own sidebar entry.
export function BlueprintEditor() {
    const [data, setData] = useState<TenantBlueprint | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const load = () => {
        setLoading(true);
        setError(false);
        blueprintApi.get()
            .then(({ blueprint }) => setData(blueprint))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    // Used after any add/edit/remove/reorder mutation — re-fetches without
    // touching `loading`, so the page never drops back to the full-screen
    // LoadingState and remounts every node (which previously collapsed every
    // expanded card's state right after a mutation). `load` stays for the
    // initial mount and the explicit Refresh button, where a brief spinner is fine.
    const refresh = () => {
        blueprintApi.get()
            .then(({ blueprint }) => setData(blueprint))
            .catch(() => setError(true));
    };

    useEffect(load, []);

    if (loading) return <LoadingState label="Loading blueprint…" />;
    if (error || !data) return <ErrorState onRetry={load} />;

    const expectedColumns = data.levels.flatMap(l => l.properties.map(p => p.ingestKey));

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
                <p className="text-sm text-zinc-400 leading-relaxed max-w-[70ch]">
                    The tree below defines the org/location/asset hierarchy this tenant&rsquo;s structure uploads
                    must match. <code className="text-zinc-300">Facility</code>/<code className="text-zinc-300">Asset</code>{' '}
                    are reserved — every other module already depends on those two node types.
                </p>
                <div className="flex items-center gap-2 shrink-0">
                    <ExportRestoreControls onRestored={load} />
                    <RefreshButton onClick={load} />
                </div>
            </div>
            {data.levels.length === 0 ? (
                <AddLevelForm onAdded={refresh} />
            ) : (
                <LevelNode level={data.levels[0]} levels={data.levels} position={0} onChanged={refresh} />
            )}

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-3">
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-2">Expected structure-upload CSV columns, in order</p>
                <p className="text-xs font-mono text-zinc-400 leading-relaxed break-words">{expectedColumns.join(', ')}</p>
            </div>
        </div>
    );
}

export function TenantBlueprintView() {
    return (
        <div className="h-full flex flex-col overflow-hidden bg-zinc-950 text-zinc-100">
            <PageHeader icon={Layers} iconClassName="text-sky-400" title="Blueprint" subtitle="Structure hierarchy for the active tenant" />
            <div className="flex-1 overflow-auto px-6 py-4">
                <BlueprintEditor />
            </div>
        </div>
    );
}
