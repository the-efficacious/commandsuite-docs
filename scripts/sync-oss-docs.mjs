#!/usr/bin/env node
/**
 * Sync MDX docs from the csuite OSS repo into src/content/docs/.
 *
 * Two modes:
 *   LOCAL   — if a sibling OSS checkout exists (see LOCAL_HINTS),
 *             or if OSS_DOCS_LOCAL is set, symlink it for instant HMR.
 *   REMOTE  — otherwise, fetch the docs/ tree from GitHub at DOCS_REF
 *             (default: main) and write MDX files into src/content/docs/.
 *
 * Only *.mdx files are synced. Plain *.md files in the OSS docs/ directory
 * are ignored (they may be internal-only architecture notes without
 * frontmatter — the docs site schema requires frontmatter).
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '../src/content/docs');
// Sibling OSS checkouts to try for LOCAL mode (first match wins).
const LOCAL_HINTS = [
  resolve(HERE, '../../commandsuite/docs'),
  resolve(HERE, '../../commandsuite-public/docs'),
];

const REPO_SLUG = process.env.DOCS_REPO ?? 'the-efficacious/commandsuite';
const REF = process.env.DOCS_REF ?? 'main';
const LOCAL_OVERRIDE = process.env.OSS_DOCS_LOCAL;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

function log(msg) {
  console.log(`[sync-oss-docs] ${msg}`);
}

function cleanOutDir() {
  // lstatSync (NOT existsSync) so a DANGLING symlink is still removed —
  // existsSync follows the link and returns false for a broken target,
  // leaving a stale link that the later mkdir chokes on with ENOENT.
  // This is the exact failure a committed absolute symlink produces when
  // checked out on a machine (e.g. CI) where the target doesn't exist.
  try {
    const st = lstatSync(OUT_DIR); // lstat throws ENOENT only if nothing is there
    // A symlink (LOCAL mode, or a dangling committed link) must be UNLINKED:
    // it operates on the link itself and never follows it. rmSync instead
    // stats the target to decide how to remove — for a DANGLING link that
    // stat fails and, with force, no-ops, leaving the stale link for the
    // mkdir/symlink below to trip over (EEXIST / ENOENT). unlink has no such
    // failure mode.
    if (st.isSymbolicLink()) unlinkSync(OUT_DIR);
    else rmSync(OUT_DIR, { recursive: true, force: true });
  } catch {
    /* nothing at OUT_DIR — clean slate */
  }
  mkdirSync(dirname(OUT_DIR), { recursive: true });
}

function resolveLocalPath() {
  if (LOCAL_OVERRIDE) {
    const abs = resolve(LOCAL_OVERRIDE);
    if (!existsSync(abs)) {
      throw new Error(`OSS_DOCS_LOCAL points at non-existent path: ${abs}`);
    }
    return abs;
  }
  for (const hint of LOCAL_HINTS) {
    if (existsSync(hint)) {
      return hint;
    }
  }
  return null;
}

async function syncLocal(localPath) {
  log(`LOCAL source: ${localPath}`);
  symlinkSync(localPath, OUT_DIR, 'dir');
  const entries = readdirSync(localPath, { recursive: true }).filter(
    (p) => typeof p === 'string' && p.endsWith('.mdx'),
  );
  log(`symlinked (${entries.length} mdx files visible)`);
}

async function githubFetch(url) {
  const headers = {
    'user-agent': 'commandsuite-platform-sync',
    accept: 'application/vnd.github+json',
  };
  if (GITHUB_TOKEN) headers.authorization = `Bearer ${GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub ${res.status} ${res.statusText}: ${url}`);
  }
  return res;
}

async function syncRemote() {
  log(`REMOTE source: ${REPO_SLUG}@${REF}`);
  const treeUrl = `https://api.github.com/repos/${REPO_SLUG}/git/trees/${REF}?recursive=1`;
  const treeRes = await githubFetch(treeUrl);
  const tree = await treeRes.json();
  if (tree.truncated) {
    log('WARN: GitHub tree response truncated — repo is larger than API page limit');
  }
  const docFiles = tree.tree.filter(
    (node) => node.type === 'blob' && node.path.startsWith('docs/') && node.path.endsWith('.mdx'),
  );

  if (docFiles.length === 0) {
    log('WARN: no .mdx files found under docs/ — nothing to sync');
  }

  mkdirSync(OUT_DIR, { recursive: true });
  for (const file of docFiles) {
    const rawUrl = `https://raw.githubusercontent.com/${REPO_SLUG}/${REF}/${file.path}`;
    const res = await fetch(rawUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${rawUrl}: ${res.status}`);
    }
    const body = await res.text();
    const relPath = file.path.slice('docs/'.length);
    const outPath = join(OUT_DIR, relPath);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, body);
    log(`  ${relPath}`);
  }
  log(`wrote ${docFiles.length} files from ${REPO_SLUG}@${REF}`);
}

async function main() {
  cleanOutDir();
  const localPath = resolveLocalPath();
  if (localPath) {
    await syncLocal(localPath);
  } else {
    await syncRemote();
  }
}

main().catch((err) => {
  console.error(`[sync-oss-docs] ERROR: ${err.message}`);
  process.exit(1);
});
