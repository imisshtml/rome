#!/usr/bin/env node
/**
 * Writes src/buildInfo.ts + public/build-meta.json (commit SHA for UI + update banner).
 * Runs on postinstall / prestart / preweb / prebuild:web.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function tryGit(cmd) {
  try {
    return execSync(cmd, { stdio: ['pipe', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

const fullSha =
  process.env.COMMIT_REF ||
  tryGit('git rev-parse HEAD') ||
  '';

const shortSha = fullSha ? fullSha.substring(0, 7) : 'dev';

const branch =
  process.env.HEAD ||
  process.env.BRANCH ||
  tryGit('git rev-parse --abbrev-ref HEAD') ||
  'unknown';

const commitDate =
  tryGit('git log -1 --format=%cI') ||
  new Date().toISOString();

const buildTime = new Date().toISOString();

const root = path.join(__dirname, '..');
const outPath = path.join(root, 'src', 'buildInfo.ts');
const contents = `// AUTO-GENERATED — see scripts/generate-build-info.js
export const BUILD_INFO = {
  commitSha: ${JSON.stringify(shortSha)},
  commitShaFull: ${JSON.stringify(fullSha || shortSha)},
  branch: ${JSON.stringify(branch)},
  commitDate: ${JSON.stringify(commitDate)},
  buildTime: ${JSON.stringify(buildTime)},
} as const;
`;

fs.writeFileSync(outPath, contents);

const publicDir = path.join(root, 'public');
const metaPath = path.join(publicDir, 'build-meta.json');
const metaPayload = {
  commitSha: shortSha,
  commitShaFull: fullSha || shortSha,
  branch,
  commitDate,
  buildTime,
};
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
fs.writeFileSync(metaPath, `${JSON.stringify(metaPayload, null, 0)}\n`);

console.log(`[build-info] sha=${shortSha} branch=${branch}`);
