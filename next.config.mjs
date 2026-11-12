/** Static export: `npm run build` writes plain HTML/JS/CSS to /out, deployable to any static host.
 *  Skills are read from content/skills at BUILD time; nothing runs on a server afterwards. */
const nextConfig = { output: 'export', images: { unoptimized: true } };
export default nextConfig;
