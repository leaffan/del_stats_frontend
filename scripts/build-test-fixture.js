#!/usr/bin/env node
'use strict';

// Runs the active (non-skipped) Playwright test suite against whatever real
// data/ this machine has locally, recording every request each test makes.
// From that it copies the exact data/ files the suite actually touches into
// fixture-out/, so the fixture is guaranteed complete (no page loads 404)
// and minimal (nothing unused gets dragged in). cfg/ files are already
// committed to the repo, so they're reported but not copied.
//
// It also writes fixture-manifest.json (committed to the repo: every file with
// its sha256) and packs fixture-out/fixture-<hash>.tar.gz. The archive is named
// after the manifest content, so upload it under exactly that name.
//
// Usage: pnpm run harvest-fixture

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { repoRoot, manifestPath, sha256File, archiveNameFor } = require('./fixture-manifest');

const harDir = path.join(repoRoot, '.fixture-harvest', 'har');
const outDir = path.join(repoRoot, 'fixture-out');

function resetDir(dir) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
}

resetDir(harDir);
resetDir(outDir);

console.log('Running the test suite against local data/ to record which files it requests...');
// run Playwright with the current node instead of through pnpm: pnpm would
// re-sync node_modules first, and pnpm from another OS breaks its symlinks
const result = spawnSync(
    process.execPath,
    [require.resolve('@playwright/test/cli'), 'test', '--workers=1'],
    {
        cwd: repoRoot,
        stdio: 'inherit',
        env: { ...process.env, HARVEST_FIXTURE_DIR: harDir },
    },
);
if (result.error) throw result.error;
console.log(
    `Test run finished with exit code ${result.status} (failures are fine here - we only care about the requests that were made).`,
);

const harFiles = fs.readdirSync(harDir).filter((f) => f.endsWith('.har'));
if (harFiles.length === 0) {
    console.error(
        'No HAR files were recorded - is HARVEST_FIXTURE_DIR wired up in tests/support/test-base.js?',
    );
    process.exit(1);
}

const requested = new Set();
function addIfLocalFile(rawUrl) {
    const url = new URL(rawUrl, 'http://localhost:8000');
    if (url.hostname !== 'localhost') return;
    const relPath = decodeURIComponent(url.pathname).replace(/^\//, '');
    if (relPath.startsWith('data/') || relPath.startsWith('cfg/')) {
        requested.add(relPath);
    }
}
for (const file of harFiles) {
    const har = JSON.parse(fs.readFileSync(path.join(harDir, file), 'utf8'));
    for (const entry of har.log.entries) addIfLocalFile(entry.request.url);
}
// page.request.* calls (e.g. HEAD existence checks) aren't part of a HAR
for (const file of fs.readdirSync(harDir).filter((f) => f.endsWith('.api.txt'))) {
    for (const line of fs.readFileSync(path.join(harDir, file), 'utf8').split('\n')) {
        if (line.trim()) addIfLocalFile(line.trim());
    }
}

const sorted = [...requested].sort();
const dataFiles = sorted.filter((p) => p.startsWith('data/'));
const cfgFiles = sorted.filter((p) => p.startsWith('cfg/'));

let copied = 0;
let missing = [];
let totalBytes = 0;
for (const relPath of dataFiles) {
    const src = path.join(repoRoot, relPath);
    const dest = path.join(outDir, relPath);
    if (!fs.existsSync(src)) {
        missing.push(relPath);
        continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    totalBytes += fs.statSync(src).size;
    copied++;
}

const copiedFiles = dataFiles.filter((p) => !missing.includes(p));
const files = copiedFiles.map((relPath) => {
    const dest = path.join(outDir, relPath);
    return { path: relPath, sha256: sha256File(dest), bytes: fs.statSync(dest).size };
});
const archive = archiveNameFor(files);
fs.writeFileSync(manifestPath, `${JSON.stringify({ archive, files }, null, 4)}\n`);

const archivePath = path.join(outDir, archive);
const tar = spawnSync('tar', ['-czf', archivePath, '-C', outDir, 'data'], { stdio: 'inherit' });
if (tar.status !== 0) {
    console.error('Packing the archive with tar failed.');
    process.exit(1);
}

console.log('');
console.log(`data/ files requested by the active test suite: ${dataFiles.length}`);
console.log(
    `  copied into ${path.relative(repoRoot, outDir)}/: ${copied} (${(totalBytes / 1024 / 1024).toFixed(2)} MiB uncompressed)`,
);
if (missing.length) {
    console.log(
        `  requested but not found locally (page tolerated a 404, safe to ignore): ${missing.length}`,
    );
    missing.forEach((p) => console.log(`    - ${p}`));
}
console.log(`cfg/ files requested: ${cfgFiles.length} (already committed to the repo, not copied)`);
console.log('');
console.log('Files copied:');
copiedFiles.forEach((p) => console.log(`  ${p}`));
console.log('');
console.log(`Manifest written: ${path.relative(repoRoot, manifestPath)} (${files.length} files)`);
console.log(
    `Archive built:    ${path.relative(repoRoot, archivePath)} (${(fs.statSync(archivePath).size / 1024 / 1024).toFixed(2)} MiB)`,
);
console.log('');
console.log('Next steps:');
console.log(
    `  1. upload ${path.relative(repoRoot, archivePath)} to the S3 bucket, name unchanged: ${archive}`,
);
console.log('  2. commit fixture-manifest.json together with the code it was harvested for');
console.log(
    '  3. node scripts/prune-fixtures.js s3://<bucket>   (lists archives nobody needs any more)',
);
