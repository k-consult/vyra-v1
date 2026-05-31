import winston from 'winston';
import { colors, levels } from './def';
import * as cT from './t-console';
import * as fT from './t-file';

interface CustomLogger extends winston.Logger {
    cypher(graph: string, reqID: number, message: string, cypher: string, records: number, latency: number): winston.Logger;
}

winston.addColors(colors);

const logger = winston.createLogger({ levels, transports: [] }) as CustomLogger;

logger.cypher = function (graph, reqID, message, cypher, records, latency) {
    return this.log({ level: 'cypher', message, graph, reqID, cypher, records, latency });
};

const appMode = process.env.NODE_ENV || 'development';
switch (appMode) {
    case 'production':
        logger.add(cT.cInfoProd);
        logger.add(cT.cErrorProd);
        logger.add(fT.fInfo);
        logger.add(fT.fError);
        logger.add(fT.fCypher);
        logger.add(fT.fWarn);
        break;
    default:
        logger.add(cT.cDebug);
        logger.add(fT.fInfo);
        logger.add(fT.fCypher);
        logger.add(fT.fWarn);
        logger.add(fT.fError);
        logger.add(fT.fDebug);
}

export default logger;
