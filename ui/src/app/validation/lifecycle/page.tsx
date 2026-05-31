import { LifecycleView } from '@/features/validation/lifecycle-view';
import { Breadcrumb } from '@/components/breadcrumb';

export default function LifecyclePage() {
    return (
        <main className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
            <div className="max-w-7xl mx-auto flex flex-col gap-6">
                <div>
                    <Breadcrumb crumbs={[{ label: 'Validation' }, { label: 'Incident Lifecycle' }]} />
                    <h1 className="text-xl font-semibold text-zinc-100">Incident Lifecycle Validator</h1>
                    <p className="text-sm text-zinc-500 mt-1">
                        Validates Use Case 1 — 11-stage incident lifecycle against live graph data.
                    </p>
                </div>
                <LifecycleView />
            </div>
        </main>
    );
}
