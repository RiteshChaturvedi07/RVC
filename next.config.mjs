/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permit testing the development server from a phone on the local network.
  // Without this, Next's dev-origin protection can prevent client hydration
  // when the app is opened through the LAN IP instead of localhost.
  allowedDevOrigins: ['10.194.61.63'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
