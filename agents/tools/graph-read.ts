import { DB } from '../../lib/graph-db';
import { config } from '../../lib/config';

const db = () => DB.get(config.db.twin.database, {
    uri: config.db.twin.uri,
    user: config.db.twin.user,
    password: config.db.twin.password,
});

export const fetchRequirements = async (regulationId?: string) => {
    const cypher = regulationId
        ? `MATCH (reg:Regulation {id: $id})-[:CONTAINS]->(:Clause)-[:DEFINES]->(req:Requirement) RETURN properties(req) AS requirement`
        : `MATCH (req:Requirement) RETURN properties(req) AS requirement LIMIT 100`;
    const args = regulationId ? { id: regulationId } : {};
    // TODO: execute and return results
    return [];
};

export const fetchControlsForRequirement = async (requirementId: string) => {
    const cypher = `
        MATCH (req:Requirement {id: $id})<-[:IMPLEMENTS]-(ctl:Control)
        RETURN properties(ctl) AS control
    `;
    // TODO: execute and return results
    return [];
};

export const traceForward = async (regulationId: string) => {
    const cypher = `
        MATCH path = (:Regulation {id: $id})-[:CONTAINS]->(:Clause)-[:DEFINES]->(:Requirement)<-[:IMPLEMENTS]-(:Control)
        RETURN path LIMIT 50
    `;
    // TODO: execute and return path
    return [];
};
