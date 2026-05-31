import { TraceabilityView } from '@/features/validation/traceability-view';
import { Breadcrumb } from '@/components/breadcrumb';

export default function TraceabilityPage() {
    return (
        <main className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
            <div className="max-w-4xl mx-auto flex flex-col gap-6">
                <div>
                    <Breadcrumb crumbs={[{ label: 'Validation' }, { label: 'Reverse Traceability' }]} />
                    <h1 className="text-xl font-semibold text-zinc-100">Reverse Traceability Matrix</h1>
                    <p className="text-sm text-zinc-500 mt-1">
                        Validates Use Case 2 — 5-layer backward trace from incident to source documents.
                    </p>
                </div>
                <TraceabilityView />
            </div>
        </main>
    );
}
