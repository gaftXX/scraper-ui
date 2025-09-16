import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't resolve 'fs' module on the client to prevent this error on build
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        buffer: false,
        util: false,
        querystring: false,
        child_process: false,
        worker_threads: false,
        ws: false,
        bufferutil: false,
        'utf-8-validate': false,
      };
    }
    
    // Handle WebSocket and buffer utilities
    config.externals = config.externals || [];
    config.externals.push({
      'bufferutil': 'bufferutil',
      'utf-8-validate': 'utf-8-validate',
      'ws': 'ws'
    });

    return config;
  },
  serverExternalPackages: ['puppeteer', 'puppeteer-core', 'ws', 'bufferutil', 'utf-8-validate']
};

export default nextConfig;
