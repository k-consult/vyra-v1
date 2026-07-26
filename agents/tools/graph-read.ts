import { DB } from '../../lib/graph-db';
import { config } from '../../lib/config';

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

// "Uncontrolled" — no Control implements this Requirement yet. That's the actual
// signal control-intelligence needs; a plain unfiltered list would recommend
// controls for requirements that already have one.
export const fetchRequirements = async (regulationId?: string) => {
    const cypher = regulationId
        ? `MATCH (reg:Regulation {id: $id})<-[:BELONGS_TO]-(:Clause)<-[:DEFINED_BY]-(req:Requirement)
           WHERE NOT (req)<-[:IMPLEMENTS]-(:Control)
           RETURN properties(req) AS requirement`
        : `MATCH (req:Requirement)
           WHERE NOT (req)<-[:IMPLEMENTS]-(:Control)
           RETURN properties(req) AS requirement LIMIT 100`;
    const args = regulationId ? { id: regulationId } : {};
    const raw: any = await db().fetch2(cypher, args);
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.requirement).filter(Boolean);
};

export const fetchControlsForRequirement = async (requirementId: string) => {
    const cypher = `
        MATCH (req:Requirement {id: $id})<-[:IMPLEMENTS]-(ctl:Control)
        RETURN properties(ctl) AS control
    `;
    const raw: any = await db().fetch2(cypher, { id: requirementId });
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.control).filter(Boolean);
};

export const traceForward = async (regulationId: string) => {
    const cypher = `
        MATCH path = (:Regulation {id: $id})<-[:BELONGS_TO]-(:Clause)<-[:DEFINED_BY]-(:Requirement)<-[:IMPLEMENTS]-(:Control)
        RETURN path LIMIT 50
    `;
    const raw: any = await db().fetch2(cypher, { id: regulationId });
    const rows = Array.isArray(raw) ? raw : [raw];
    return rows.map((r: any) => r.path).filter(Boolean);
};
