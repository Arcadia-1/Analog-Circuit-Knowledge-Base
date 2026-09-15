// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import svelte from '@astrojs/svelte';
import sitemap from '@astrojs/sitemap';

// AMS Class: a static site of interactive analog/mixed-signal illustrations.
// Every page is prerendered; interactive parts are Svelte islands, and the copied analytics module (analytics/) is React.
export default defineConfig({
  site: 'https://ams-class.tokenzhang.com',
  output: 'static',
  trailingSlash: 'always',
  integrations: [svelte(), react(), sitemap({ filter: (page) => !page.endsWith('/analytics/') })],
  build: { format: 'directory', inlineStylesheets: 'auto' },
});
