// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://awesome-agent-tools.com',
  trailingSlash: 'never',
  integrations: [sitemap()],
  build: {
    // Emit /tools/read.html rather than /tools/read/index.html so the URLs the
    // site asks to be cited are the URLs the server actually serves.
    format: 'file',
  },
});
