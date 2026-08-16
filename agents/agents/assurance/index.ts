import { defaultContext, runAgentLoop, reasonWithLLM, Reasoning } from '../../runtime';
import { fetchUnbundledEvidenceIncidents } from '../../tools/graph-read';
import { writeDecision, DecisionPayload } from '../../tools/graph-write';
import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';

// Assurance Intelligence Agent
// Reads Incidents whose Evidence hasn't been bundled into an EvidencePackage yet, and
// proposes assembling the Audit-Ready Export chain (EvidencePackage/Attestation/
// AssuranceStatement/Audit) via a local LLM. Autonomy Level 1: proposes only — writes
// Decision nodes, does not create the assurance chain itself.
//
// Replaces cli/scripts/generate-assurance-seed.ts for new Incidents going forward; that
// script stays as-is and only ever touches the original 7-incident historical batch.

interface UnbundledIncident {
    id: string;
    name: string;
    scope?: string;
    evidence: { id: string }[];
    capaCount: number;
    allCapasVerified: boolean;
}

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

// Posture is computed here, not left to the LLM — same rule
// cli/scripts/generate-assurance-seed.ts already established: "Compliant" only if every
// CAPA reachable from the incident has a Verification.
const computePosture = (allCapasVerified: boolean): string =>
    allCapasVerified ? 'Compliant' : 'Compliant with open corrective action';

export const run = async (): Promise<void> => {
    const ctx = defaultContext();
    ctx.agentId = 'assurance-intelligence-agent';

    await runAgentLoop<UnbundledIncident>(ctx.agentId, {
        observe: () => fetchUnbundledEvidenceIncidents() as Promise<UnbundledIncident[]>,

        reason: (inc): Promise<Reasoning> => reasonWithLLM(
            `An incident has unbundled evidence awaiting an assurance package:\n` +
            `Incident: "${inc.name}" (scope: ${inc.scope ?? 'UNKNOWN'})\n` +
            `Evidence: ${inc.evidence.length} item(s) not yet in an EvidencePackage\n` +
            `Corrective actions: ${inc.capaCount === 0 ? 'no CAPAs are reachable from this incident yet' : inc.allCapasVerified ? `all ${inc.capaCount} reachable CAPA(s) are verified` : `${inc.capaCount} reachable CAPA(s), at least one with no Verification yet`}\n` +
            `Assess, in one or two sentences, whether this evidence bundle looks ready to attest.`
        ),

        act: async (inc, reasoning) => {
            const decision: DecisionPayload = {
                id: `DEC-${inc.id}`,
                type: 'assurance-package-proposal',
                rationale: reasoning.rationale,
                agentId: ctx.agentId,
                autonomyLevel: ctx.autonomyLevel,
                confidence: reasoning.confidence,
                sourceId: inc.id,
                proposedPosture: computePosture(inc.allCapasVerified),
            };
            await writeDecision(decision);
        },

        verify: async (inc) => {
            const raw: any = await db().fetch2(
                `MATCH (d:Decision {id: $id}) RETURN properties(d) AS decision`,
                { id: `DEC-${inc.id}` }
            );
            const row = Array.isArray(raw) ? raw[0] : raw;
            return row?.decision?.status === 'pending';
        },
    });
};
