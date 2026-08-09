import { createServer, type Server } from 'node:http';

import { PrismaClient } from '@prisma/client';

import { ManagedGuildService } from '../application/guild/ManagedGuildService.js';
import { KeywordService } from '../application/keyword/KeywordService.js';
import { loadApiConfig } from '../infrastructure/config/config.js';
import { PrismaManagedGuildRepository } from '../infrastructure/persistence/prisma/guild/PrismaManagedGuildRepository.js';
import { PrismaKeywordRepository } from '../infrastructure/persistence/prisma/keyword/PrismaKeywordRepository.js';
import { createKeywordHttpHandler } from '../interface-adapter/http/keyword/createKeywordHttpHandler.js';

export interface ApiApplication {
    start: () => Promise<void>;
    stop: () => Promise<void>;
}

function listen(server: Server, port: number, host: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, (): void => {
            server.removeListener('error', reject);
            resolve();
        });
    });
}

export function createProductionApplication(serviceToken: string): ApiApplication {
    const config = loadApiConfig();
    const prisma = new PrismaClient();
    const service = new KeywordService(new PrismaKeywordRepository(prisma));
    const guildService = new ManagedGuildService(new PrismaManagedGuildRepository(prisma));
    const handler = createKeywordHttpHandler(service, guildService, {
        serviceToken,
        requestBodyLimitBytes: config.requestBodyLimitBytes,
        readiness: async (): Promise<boolean> => {
            try {
                await prisma.$queryRaw`SELECT 1`;
                return true;
            } catch {
                return false;
            }
        },
        reportError: (error: unknown): void => {
            const message = error instanceof Error ? error.message : 'unknown error';
            process.stderr.write(`API request error: ${message}\n`);
        }
    });
    const server = createServer((request, response): void => {
        request.setTimeout(config.requestTimeoutMs, (): void => {
            request.destroy(new Error('request timeout'));
        });
        void handler(request, response).catch((error: unknown): void => {
            const message = error instanceof Error ? error.message : 'unknown error';
            process.stderr.write(`API handler error: ${message}\n`);
            if (!response.headersSent) {
                response.statusCode = 500;
                response.setHeader('content-type', 'application/json; charset=utf-8');
                response.end(JSON.stringify({ error: { code: 'internal_error', message: '予期しないエラーが発生しました。' } }));
            } else {
                response.destroy();
            }
        });
    });
    let started = false;

    return {
        start: async (): Promise<void> => {
            if (started) return;
            await listen(server, config.port, config.host);
            started = true;
        },
        stop: async (): Promise<void> => {
            if (started) {
                await new Promise<void>((resolve, reject) => {
                    const timeout = setTimeout((): void => {
                        server.closeAllConnections();
                        reject(new Error(`APIを${String(config.shutdownTimeoutMs)}ms以内に終了できませんでした。`));
                    }, config.shutdownTimeoutMs);
                    server.close((): void => {
                        clearTimeout(timeout);
                        resolve();
                    });
                });
                started = false;
            }
            await prisma.$disconnect();
        }
    };
}
