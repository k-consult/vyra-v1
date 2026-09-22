'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, FileText, ArrowLeft, Plus, CheckCircle2 } from 'lucide-react';
import { enterprise, operational, ProposeContractInput } from '@/lib/api';
import { PropRow } from '@/features/landscape/landscape';

// Never writes a Contract directly — every submission is a Decision proposal,
// reviewed the same way an agent's proposal is (see /intelligence). Contracts
// are an immutable source of truth; an amendment creates a new version rather
// than editing the selected one.
function ProposeContractForm({ vendors, roles, people, contracts, onSubmitted }: {
    vendors: any[]; roles: any[]; people: any[]; contracts: any[]; onSubmitted: () => void;
}) {
    const [proposedBy, setProposedBy] = useState('');
    const [proposedVendorId, setProposedVendorId] = useState('');
    const [proposedServiceType, setProposedServiceType] = useState('');
    const [proposedSlaResponseTime, setProposedSlaResponseTime] = useState('');
    const [proposedAmcStartDate, setProposedAmcStartDate] = useState('');
    const [proposedAmcExpiryDate, setProposedAmcExpiryDate] = useState('');
    const [proposedCoordinatorRoleId, setProposedCoordinatorRoleId] = useState('');
    const [priorContractId, setPriorContractId] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);

    const submit = async () => {
        setSubmitting(true);
        setSubmitError(null);
        const input: ProposeContractInput = {
            proposedBy,
            proposedVendorId,
            proposedServiceType,
            proposedSlaResponseTime: proposedSlaResponseTime || undefined,
            proposedAmcStartDate: proposedAmcStartDate || undefined,
            proposedAmcExpiryDate: proposedAmcExpiryDate || undefined,
            proposedCoordinatorRoleId: proposedCoordinatorRoleId || undefined,
            priorContractId: priorContractId || undefined,
        };
        try {
            await enterprise.proposeContract(input);
            setSubmitted(true);
            onSubmitted();
        } catch (err: any) {
            setSubmitError(err.message || 'Proposal was rejected by the API');
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 px-4 py-3 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <p className="text-sm text-emerald-200">
                    Proposal submitted — check <Link href="/intelligence" className="underline">Intelligence</Link> to approve.
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-3">
            <p className="text-sm font-medium text-zinc-200">Propose a new or amended contract</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Proposed by</span>
                    <select value={proposedBy} onChange={e => setProposedBy(e.target.value)} className="rounded-md border border-zinc-700 bg-zinc-950 text-zinc-200 text-sm px-3 py-2">
                        <option value="">Select person…</option>
                        {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Vendor</span>
                    <select value={proposedVendorId} onChange={e => setProposedVendorId(e.target.value)} className="rounded-md border border-zinc-700 bg-zinc-950 text-zinc-200 text-sm px-3 py-2">
                        <option value="">Select vendor…</option>
                        {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Service type</span>
                    <input value={proposedServiceType} onChange={e => setProposedServiceType(e.target.value)} className="rounded-md border border-zinc-700 bg-zinc-950 text-zinc-200 text-sm px-3 py-2" />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-zinc-500 uppercase tracking-wider">SLA response time</span>
                    <input value={proposedSlaResponseTime} onChange={e => setProposedSlaResponseTime(e.target.value)} className="rounded-md border border-zinc-700 bg-zinc-950 text-zinc-200 text-sm px-3 py-2" />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-zinc-500 uppercase tracking-wider">AMC start date</span>
                    <input type="date" value={proposedAmcStartDate} onChange={e => setProposedAmcStartDate(e.target.value)} className="rounded-md border border-zinc-700 bg-zinc-950 text-zinc-200 text-sm px-3 py-2" />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-zinc-500 uppercase tracking-wider">AMC expiry date</span>
                    <input type="date" value={proposedAmcExpiryDate} onChange={e => setProposedAmcExpiryDate(e.target.value)} className="rounded-md border border-zinc-700 bg-zinc-950 text-zinc-200 text-sm px-3 py-2" />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Coordinator role</span>
                    <select value={proposedCoordinatorRoleId} onChange={e => setProposedCoordinatorRoleId(e.target.value)} className="rounded-md border border-zinc-700 bg-zinc-950 text-zinc-200 text-sm px-3 py-2">
                        <option value="">None</option>
                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Supersedes existing contract (optional)</span>
                    <select value={priorContractId} onChange={e => setPriorContractId(e.target.value)} className="rounded-md border border-zinc-700 bg-zinc-950 text-zinc-200 text-sm px-3 py-2">
                        <option value="">None — new contract</option>
                        {contracts.map(c => <option key={c.id} value={c.id}>{c.id} — {c.serviceType}</option>)}
                    </select>
                </label>
            </div>
            {submitError && <p className="text-xs text-red-400">{submitError}</p>}
            <div>
                <button
                    onClick={submit}
                    disabled={submitting || !proposedBy || !proposedVendorId || !proposedServiceType}
                    className="text-xs px-4 py-2 rounded-md bg-emerald-500 text-zinc-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50"
                >
                    {submitting ? 'Submitting…' : 'Submit proposal'}
                </button>
            </div>
        </div>
    );
}

function ContractCard({ contract, vendorName }: { contract: any; vendorName: string }) {
    const facilityCount = (contract.facilityIds ?? []).length;
    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 flex flex-col gap-1">
            <p className="text-[11px] font-mono text-zinc-500">{contract.id}</p>
            <p className="text-sm text-zinc-200 font-medium">{contract.serviceType}</p>
            <PropRow label="vendor" value={vendorName} />
            <PropRow label="sla" value={contract.slaResponseTime} />
            <PropRow label="amcStart" value={contract.amcStartDate} />
            <PropRow label="amcExpiry" value={contract.amcExpiryDate} />
            <PropRow label="coordinatorRoleId" value={contract.coordinatorRoleId} />
            <PropRow label="facilitiesCovered" value={facilityCount} />
        </div>
    );
}

export function ContractsView() {
    const [contracts, setContracts] = useState<any[]>([]);
    const [vendors, setVendors]     = useState<any[]>([]);
    const [roles, setRoles]         = useState<any[]>([]);
    const [people, setPeople]       = useState<any[]>([]);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState(false);
    const [showForm, setShowForm]   = useState(false);

    const load = () => {
        setLoading(true);
        setError(false);
        Promise.all([enterprise.contracts(), enterprise.vendors(), enterprise.roles(), operational.people()])
            .then(([c, v, r, p]) => {
                setContracts(c.contracts ?? []);
                setVendors(v.vendors ?? []);
                setRoles(r.roles ?? []);
                setPeople(p.people ?? []);
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    if (loading) {
        return (
            <div className="h-screen bg-zinc-950 flex items-center justify-center">
                <div className="flex items-center gap-3 text-zinc-500">
                    <RefreshCw size={16} className="animate-spin" />
                    <span className="text-sm">Loading contracts…</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-screen bg-zinc-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <AlertTriangle size={20} className="text-amber-500" />
                    <span className="text-sm text-zinc-500">Could not load contracts</span>
                    <button onClick={load} className="text-xs text-zinc-400 underline">Retry</button>
                </div>
            </div>
        );
    }

    const vendorNameById = new Map(vendors.map(v => [v.id, v.name]));

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-zinc-950 text-zinc-100">

            {/* ── Header ── */}
            <header className="border-b border-zinc-800/60 shrink-0">
                <div className="flex items-center justify-between px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
                            <FileText size={18} className="text-zinc-950" />
                        </div>
                        <div>
                            <p className="text-base font-semibold leading-tight">VYRA</p>
                            <p className="text-xs text-zinc-500 leading-tight">Contracts — Vendor Service Agreements</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-5">
                        <button
                            onClick={() => setShowForm(s => !s)}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-emerald-500 text-zinc-950 font-medium hover:bg-emerald-400 transition-colors"
                        >
                            <Plus size={13} /> Propose contract
                        </button>
                        <button onClick={load} className="p-2 rounded-md hover:bg-zinc-800 transition-colors" title="Refresh">
                            <RefreshCw size={14} className="text-zinc-500" />
                        </button>
                        <Link href="/" className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
                            <ArrowLeft size={13} /> Landscape
                        </Link>
                    </div>
                </div>
            </header>

            {/* ── Content ── */}
            <div className="flex-1 min-h-0 overflow-auto px-6 py-4 flex flex-col gap-3">
                {showForm && (
                    <ProposeContractForm
                        vendors={vendors}
                        roles={roles}
                        people={people}
                        contracts={contracts}
                        onSubmitted={load}
                    />
                )}
                <div className="flex items-center gap-2">
                    <FileText size={11} className="text-zinc-600" />
                    <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                        Contracts · {contracts.length} agreements · {vendors.length} vendors
                    </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {contracts.map(c => (
                        <ContractCard key={c.id} contract={c} vendorName={vendorNameById.get(c.vendorId) ?? c.vendorId} />
                    ))}
                </div>
            </div>

            {/* ── Footer ── */}
            <footer className="border-t border-zinc-800/60 px-6 py-2.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-emerald-500 flex items-center justify-center">
                        <FileText size={9} className="text-zinc-950" />
                    </div>
                    <span className="text-[10px] text-zinc-600">Vyra Platform v1</span>
                </div>
                <p className="text-[10px] text-zinc-700">Compliance. Handled.</p>
            </footer>
        </div>
    );
}
