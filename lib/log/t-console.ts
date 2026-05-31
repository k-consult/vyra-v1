import * as R from 'ramda';
import winston from 'winston';
import { fConsole } from './format';
import { LogLevel } from './def';

const transport = (level: LogLevel): winston.transports.ConsoleTransportInstance =>
    new winston.transports.Console({ level, format: fConsole });

export const cInfo = transport('info');
export const cWarn = transport('warn');
export const cDebug = transport('debug');
export const cError = transport('error');
export const cCypher = transport('cypher');
export const cInfoProd = transport('info');
export const cErrorProd = transport('error');
