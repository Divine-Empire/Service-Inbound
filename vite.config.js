import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// One id per build, baked into the bundle (__BUILD_ID__, below) and also
// written to dist/version.json by the plugin below -- UpdateBanner.jsx
// polls that file and compares it against the id its own bundle shipped
// with, to tell an open tab its JS is now stale (a Vite SPA tab left open
// across a deploy otherwise keeps running the old bundle indefinitely).
const buildId = process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now());

export default defineConfig({
  base: '/',
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [
    react(),
    {
      name: 'write-version-json',
      writeBundle(options) {
        fs.writeFileSync(
          path.join(options.dir || 'dist', 'version.json'),
          JSON.stringify({ buildId })
        );
      },
    },
  ],
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'lucide-react',
      'recharts'
    ]
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true
  }
});