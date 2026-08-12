import { DashboardQueries } from '../application/dashboard/DashboardQueries.js';
import { DashboardApiTransport } from '../infrastructure/api-client/DashboardApiTransport.js';
import { HttpDashboardGateway } from '../infrastructure/api-client/HttpDashboardGateway.js';
import { loadWebConfig } from '../infrastructure/config/webConfig.js';

export interface DashboardComposition {
    queries: DashboardQueries;
    transport: DashboardApiTransport;
    requestBodyLimitBytes: number;
}

export function createDashboardComposition(): DashboardComposition {
    const config = loadWebConfig();
    const transport = new DashboardApiTransport(config.internalApiUrl, config.apiTimeoutMs, config.apiProxyToken);
    return {
        queries: new DashboardQueries(new HttpDashboardGateway(transport)),
        transport,
        requestBodyLimitBytes: config.requestBodyLimitBytes
    };
}
