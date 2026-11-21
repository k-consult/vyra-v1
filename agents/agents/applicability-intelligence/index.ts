import * as R from 'ramda';
import { defaultContext, runAgentLoop, reasonWithLLM, Reasoning } from '../../runtime';
import { fetchUnclassifiedAssets, fetchAssetSubjectTypes } from '../../tools/graph-read';
import { writeDecision, DecisionPayload } from '../../tools/graph-write';
import { DB } from '../../../lib/graph-db';
import { config } from '../../../lib/config';

// Applicability Intelligence Agent
// Classifies tenant Assets against the SubjectType vocabulary (applicability.md §4's
// job table row 1: ASSET_CATEGORY/ASSET_NAME -> SubjectType, choose from list or "none").
// Autonomy Level 1: proposes only — writes Decision nodes, never the OF_TYPE edge itself.

interface UnclassifiedAsset {
    id: string;
    name: string;
    category?: string;
    assetType?: string;
}

interface AssetSubjectType {
    id: string;
    name: string;
}

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

export const run = async (): Promise<void> => {
    const ctx = defaultContext();
    ctx.agentId = 'applicability-intelligence-agent';

    const candidates = await fetchAssetSubjectTypes() as AssetSubjectType[];
    const candidateList = candidates.map((st) => `${st.id}: ${st.name}`).join('\n');

    await runAgentLoop<UnclassifiedAsset>(ctx.agentId, {
        observe: () => fetchUnclassifiedAssets() as Promise<UnclassifiedAsset[]>,

        reason: (asset): Promise<Reasoning> => reasonWithLLM(
            `A tenant Asset has not been classified against the regulatory SubjectType vocabulary yet:\n` +
            `Asset: "${asset.name}" (category: ${asset.category ?? 'UNKNOWN'}, assetType: ${asset.assetType ?? 'UNKNOWN'})\n` +
            `Candidate SubjectTypes (id: name):\n${candidateList}\n\n` +
            `Propose, in one or two sentences, which SubjectType this Asset is regulated as, if any.`,
            `"proposedSubjectTypeId": one of the listed ids, or the literal string "none" if no candidate applies`
        ),

        act: async (asset, reasoning) => {
            const decision: DecisionPayload = {
                id: `DEC-${asset.id}`,
                type: 'subject-type-proposal',
                rationale: reasoning.rationale,
                agentId: ctx.agentId,
                autonomyLevel: ctx.autonomyLevel,
                confidence: reasoning.confidence,
                sourceId: asset.id,
                proposedSubjectTypeId: R.defaultTo('none', reasoning.proposedSubjectTypeId),
            };
            await writeDecision(decision);
        },

        verify: async (asset) => {
            const raw: any = await db().fetch(
                `MATCH (d:Decision {id: $id}) RETURN properties(d) AS decision`,
                { id: `DEC-${asset.id}` }
            );
            const row = Array.isArray(raw) ? raw[0] : raw;
            return row?.decision?.status === 'pending';
        },
    });
};
