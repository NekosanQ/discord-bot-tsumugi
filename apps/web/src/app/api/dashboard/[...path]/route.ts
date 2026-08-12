import type { NextRequest, NextResponse } from 'next/server';

import { forwardDashboardRequest } from '../../../_composition/dashboardProxy.js';

interface RouteContext {
    params: Promise<{ path: string[] }>;
}

async function handle(request: NextRequest, context: RouteContext): Promise<NextResponse> {
    const { path } = await context.params;
    return forwardDashboardRequest(request, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
