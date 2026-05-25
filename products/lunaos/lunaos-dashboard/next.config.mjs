/** @type {import('next').NextConfig} */
const nextConfig = {
    trailingSlash: true,
    images: {
        unoptimized: true,
    },
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://api.lunaos.ai',
    },
    output: 'export',
};

export default nextConfig;
