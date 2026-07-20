import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';
import { defineConfig } from 'astro/config';

/**
 * The synced OSS docs still carry legacy `/docs/...` internal links from the
 * era when this site was mounted at agentc7.com/docs. The site is root-mounted
 * now, so strip the `/docs` prefix from internal links at build time.
 */
function rehypeStripDocsPrefix() {
  return (tree) => {
    const visit = (node) => {
      if (node.type === 'element' && node.tagName === 'a') {
        const href = node.properties?.href;
        if (typeof href === 'string') {
          if (href === '/docs' || href === '/docs/') {
            node.properties.href = '/';
          } else if (href.startsWith('/docs/')) {
            node.properties.href = href.slice('/docs'.length);
          }
        }
      }
      if (Array.isArray(node.children)) {
        node.children.forEach(visit);
      }
    };
    visit(tree);
  };
}

export default defineConfig({
  site: 'https://docs.commandsuite.io',
  output: 'static',
  adapter: cloudflare(),
  integrations: [mdx()],
  markdown: {
    rehypePlugins: [rehypeStripDocsPrefix],
    shikiConfig: {
      theme: 'github-light',
      wrap: true,
    },
  },
  build: {
    format: 'directory',
  },
  devToolbar: {
    enabled: false,
  },
});
