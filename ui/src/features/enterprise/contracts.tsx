'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, FileText, ArrowLeft } from 'lucide-react';
import { enterprise } from '@/lib/api';
import { PropRow } from '@/features/landscape/landscape';

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
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState(false);

    const load = () => {
        setLoading(true);
        setError(false);
        Promise.all([enterprise.contracts(), enterprise.vendors()])
            .then(([c, v]) => {
                setContracts(c.contracts ?? []);
                setVendors(v.vendors ?? []);
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
