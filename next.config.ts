import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
	outputFileTracingRoot: process.cwd(),
};

initOpenNextCloudflareForDev();

export default nextConfig;