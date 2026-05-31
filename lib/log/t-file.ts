import * as R from 'ramda';
import * as fs from 'fs';
import * as path from 'path';
import winston from 'winston';
import { fFile } from './format';
import { formatters, LogLevel } from './def';

const _5MB = 5242880;
const logsDir = './logs/';
const dir = path.resolve(logsDir);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const fPath = (level: LogLevel): string => path.join(logsDir, `${level}.log`);

const transport = (level: LogLevel): winston.transports.FileTransportInstance =>
    new winston.transports.File({
        filename: fPath(level),
        level,
        format: winston.format.combine(fFile, formatters[level]),
        maxsize: _5MB,
        maxFiles: 5,
    });

export const fInfo = transport('info');
export const fWarn = transport('warn');
export const fDebug = transport('debug');
export const fError = transport('error');
export const fCypher = transport('cypher');
