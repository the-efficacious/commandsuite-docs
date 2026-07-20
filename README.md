# commandsuite-docs

The plumbing behind **[docs.commandsuite.io](https://docs.commandsuite.io)** — an
Astro site deployed to Cloudflare Workers.

**The docs content does not live here.** The canonical MDX lives in the
[CommandSuite OSS repo](https://github.com/the-efficacious/commandsuite) under
[`docs/`](https://github.com/the-efficacious/commandsuite/tree/main/docs), versioned
with the product. This repo is presentation only: layout, navigation, styling, and
deployment.

- **Fix or improve the docs?** → PR against
  [`commandsuite/docs/`](https://github.com/the-efficacious/commandsuite/tree/main/docs).
- **Fix the docs *site*** (layout, nav, search, styling)? → PR here.

## How it works

At build time, `scripts/sync-oss-docs.mjs` pulls `docs/*.mdx` from the OSS repo's
`main` (or symlinks a local sibling checkout for dev HMR) into `src/content/docs/`,
and Astro renders it. Deploys run from GitHub Actions: on push to `main`, on a
30-minute schedule that rebuilds only when the OSS `docs/` tree has changed, and
manually via workflow dispatch.

## Dev

```bash
pnpm install
pnpm dev        # syncs docs (local sibling checkout if present, else GitHub) + astro dev
pnpm build      # sync + production build
pnpm deploy     # build + wrangler deploy (needs Cloudflare auth)
```

## License

Apache-2.0, same as the OSS repo.
