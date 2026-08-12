import type { NextConfig } from 'next';

const securityHeaders = [
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' }
];

const nextConfig: NextConfig = {
    agentRules: false,
    output: 'standalone',
    poweredByHeader: false,
    productionBrowserSourceMaps: false,
    async headers() {
        return [{ source: '/:path*', headers: securityHeaders }];
    },
    webpack(config) {
        config.resolve.extensionAlias = {
            ...config.resolve.extensionAlias,
            '.js': ['.ts', '.tsx', '.js']
        };
        return config;
    }
};

export default nextConfig;
