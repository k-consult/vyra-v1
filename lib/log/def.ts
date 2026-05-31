import winston from 'winston';

const levelFilter = (levels: string[]) => winston.format((info) => {
    if (levels.includes(info.level)) {
        return info;
    }
    return false;
})();

export const levels = {
    error: 0,
    warn: 1,
    info: 2,
    cypher: 3,
    debug: 4
} as const;

export const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'white',
    cypher: 'green',
    debug: 'blue'
};

export const formatters = {
    error: levelFilter(['error']),
    warn: levelFilter(['warn']),
    info: levelFilter(['info', 'warn', 'error']),
    cypher: levelFilter(['cypher']),
    debug: levelFilter(['info', 'warn', 'error', 'cypher', 'debug'])
} as const;

export type LogLevel = keyof typeof levels;
export type LogColor = keyof typeof colors;
