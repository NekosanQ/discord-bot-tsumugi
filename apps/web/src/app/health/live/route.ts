import { NextResponse } from 'next/server';

function get(): NextResponse {
    const headers = new Headers();
    headers.set('cache-control', 'no-store');
    return NextResponse.json({ status: 'ok' }, { headers });
}

export { get as GET };
