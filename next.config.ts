import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // AGENTS.md is this repository's governance document. `next dev` otherwise appends
  // its own instruction block to it on every start, mutating a tracked file.
  agentRules: false,
};

export default nextConfig;
