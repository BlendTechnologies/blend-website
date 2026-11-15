/* Finding the Blend-OS workspace from inside this repository.
   ------------------------------------------------------------
   This site is its own git repository and a submodule of the Blend-OS
   workspace, which holds the engine, the webapp and PRODUCT_FACTS.md. The
   tools that read any of those used to assume the site sits at
   apps/blend-website and reach for ../../. That is true of the submodule
   checkout and false of every worktree under .claude/worktrees/, which is
   where the website is actually worked on. So: walk up from the site until
   a directory looks like the workspace, or take BLEND_OS when it is set.

   A worktree of the workspace is also a workspace. tools/refresh.mjs wants
   one at origin/main precisely because the shared checkout rarely is. */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export function isWorkspace(dir) {
  return existsSync(join(dir, 'PRODUCT_FACTS.md'))
    && existsSync(join(dir, 'algorithms/personalization/tools/export_science_facts.py'));
}

/** The workspace root, or null when none is reachable. BLEND_OS wins, and a
 *  wrong BLEND_OS is an error rather than a silent fallback. */
export function findWorkspace(from) {
  const env = process.env.BLEND_OS;
  if (env) {
    if (isWorkspace(env)) return resolve(env);
    throw new Error(`BLEND_OS=${env} is not a Blend-OS checkout (no PRODUCT_FACTS.md and algorithms/personalization there)`);
  }
  let dir = resolve(from);
  for (;;) {
    if (isWorkspace(dir)) return dir;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}
