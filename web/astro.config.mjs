// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import sitemap from '@astrojs/sitemap';

// AMS Class: a static site of interactive analog/mixed-signal illustrations.
// Every page is prerendered; interactive parts are Svelte islands hydrated on the client.
export default defineConfig({
  site: 'https://ams-class.tokenzhang.com',
  output: 'static',
  trailingSlash: 'always',
  integrations: [svelte(), sitemap()],
  build: { format: 'directory', inlineStylesheets: 'auto' },
});
