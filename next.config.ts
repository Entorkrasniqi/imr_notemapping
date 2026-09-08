import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hides the on-screen route indicator (the small circular logo in the
  // bottom-left corner during `next dev`) — it only ever surfaces route
  // rendering info we're not using yet, and sat directly under the
  // canvas's own zoom controls. Compile/runtime errors still surface
  // normally either way.
  devIndicators: false,
};

export default nextConfig;
