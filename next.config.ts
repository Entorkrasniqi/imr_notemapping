import type { NextConfig } from "next";
import { STATIC_SECURITY_HEADERS } from "./lib/security/headers";

const nextConfig: NextConfig = {
  // Hides the on-screen route indicator (the small circular logo in the
  // bottom-left corner during `next dev`) — it only ever surfaces route
  // rendering info we're not using yet, and sat directly under the
  // canvas's own zoom controls. Compile/runtime errors still surface
  // normally either way.
  devIndicators: false,
  // Don't advertise the framework in an `X-Powered-By` header.
  poweredByHeader: false,
  // Security headers on every response, API routes included. The
  // Content-Security-Policy is set per request in proxy.ts instead, since
  // it carries a nonce. See docs/SECURITY.md §3.
  async headers() {
    return [{ source: "/:path*", headers: [...STATIC_SECURITY_HEADERS] }];
  },
};

export default nextConfig;
