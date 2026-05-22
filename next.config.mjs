/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    '@solana/web3.js',
    'rpc-websockets',
    'eventemitter3',
    'ws',
    'bufferutil',
    'utf-8-validate',
  ],
};

export default nextConfig;
