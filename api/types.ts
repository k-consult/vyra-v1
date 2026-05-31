import { FastifyPluginAsync } from 'fastify';

export interface Module extends FastifyPluginAsync {
    prefix: string;
}
