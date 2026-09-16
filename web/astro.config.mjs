// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import svelte from '@astrojs/svelte';
import sitemap from '@astrojs/sitemap';

// ADCToolbox: the interactive side of the toolbox. Every page is prerendered; the interactive parts are Svelte islands
// and the copied analytics module (analytics/) is React. The reference manual is built into dist/doc by the deploy
// workflow, from the Sphinx source in the ADCToolbox repository.
export default defineConfig({
  site: 'https://adctoolbox.tokenzhang.com',
  output: 'static',
  trailingSlash: 'always',
  integrations: [svelte(), react(), sitemap({ filter: (page) => !page.endsWith('/analytics/') })],
  build: { format: 'directory', inlineStylesheets: 'auto' },
});
