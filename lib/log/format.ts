import * as R from 'ramda';
import winston from 'winston';
import { colors } from './def';

const { json, splat } = winston.format;

const namespace = { get: (_key: string) => null };

interface CypherInfo { graph?: string; reqID?: number; cypher?: string; records?: number; latency?: number; message: string; level: string; }
interface ErrorInfo { error?: Error | string; message: string; level: string; [key: string]: any; }
interface MetaInfo { meta?: any; message: string; level: string; }
interface LogInfo { level: string; message: string; timestamp?: string; [key: string]: any; }

function _formatCypher(cypher: string): string {
    const keywords = ["MATCH", "WHERE", "WITH", "RETURN"];
    let formattedQuery = '\n';
    let currentLine = '';
    let andCount = 0;
    cypher.split(/\s+/).forEach(word => {
        if (keywords.includes(word.toUpperCase())) {
            if (currentLine) formattedQuery += currentLine.trim() + '\n';
            currentLine = word + ' ';
            andCount = 0;
        } else if (word.toUpperCase() === 'AND') {
            andCount++;
            if (andCount <= 2) { currentLine += word + ' '; }
            else { formattedQuery += currentLine.trim() + '\n'; currentLine = word + ' '; andCount = 1; }
        } else { currentLine += word + ' '; }
    });
    if (currentLine) formattedQuery += currentLine.trim();
    return formattedQuery;
}

const formatter = {
    cypher: (info: CypherInfo): LogInfo => {
        const graph = info.graph || '';
        const reqID = info.reqID ? info.reqID.toLocaleString() : '-na-';
        const records = info.records ? info.records.toLocaleString() : '-na-';
        const latency = info.latency ? info.latency.toLocaleString() + 'ms' : '-na-';
        const cypher = _formatCypher(info.cypher || '');
        return { ...info, message: `[${graph}][reqID: ${reqID}, #record(s): ${records}, ts: ${latency}]: ${info.message} ${cypher}\n` };
    },
    error: (info: ErrorInfo): LogInfo => {
        if (info.error) {
            info.message += info.error instanceof Error
                ? `: ${info.error.message}${info.error.stack ? '\nStack: ' + info.error.stack : ''}`
                : `: ${info.error}`;
        }
        return info as LogInfo;
    },
    info: (info: MetaInfo): LogInfo => {
        if (info.meta) info.message += `: ${R.type(info.meta) === "Object" ? JSON.stringify(info.meta) : info.meta}`;
        return info as LogInfo;
    },
    debug: (info: MetaInfo): LogInfo => {
        if (info.meta) info.message += `: ${R.type(info.meta) === "Object" ? JSON.stringify(info.meta) : info.meta}`;
        return info as LogInfo;
    },
    warn: (info: MetaInfo): LogInfo => {
        if (info.meta) info.message += `: ${R.type(info.meta) === "Object" ? JSON.stringify(info.meta) : info.meta}`;
        return info as LogInfo;
    },
    _default: (info: LogInfo): LogInfo => info
};

const format = (info: LogInfo): LogInfo => {
    const fmt = R.compose(R.propOr(formatter._default, R.__, formatter), R.prop('level'))(info) as (info: LogInfo) => LogInfo;
    return fmt(info);
};

const toString = (level: string, message: string, timestamp: string): string => {
    const pm2ID = process.env.pm_id ? `[PM2-${process.env.pm_id}]` : '';
    return `${timestamp} ${level.toUpperCase()} ${pm2ID}: ${message}`;
};

const fileFormatter = winston.format((info: winston.Logform.TransformableInfo) => format(info as LogInfo) as winston.Logform.TransformableInfo)();

const consoleFormatter = winston.format.printf((info: winston.Logform.TransformableInfo) => {
    const formattedInfo = format(info as LogInfo);
    return toString(formattedInfo.level, formattedInfo.message, formattedInfo.timestamp || '');
});

export const fFile = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss A' }),
    splat(),
    fileFormatter,
    winston.format.printf(({ level, message, timestamp }) => toString(level as string, message as string, (timestamp as string) || ''))
);

export const fConsole = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss A' }),
    winston.format.errors({ stack: false }),
    splat(),
    consoleFormatter,
    winston.format.colorize({ all: true }),
);
