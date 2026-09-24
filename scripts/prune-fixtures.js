#!/usr/bin/env node
'use strict';

// Lists fixture archives in the S3 bucket that no manifest still needs and
// prints the `aws s3 rm` commands for them. It never deletes anything itself.
//
// An archive is still needed when the fixture-manifest.json at any branch or tag
// tip, or in any commit from the last N days, points at it. 90 days matches how
// long GitHub keeps workflow runs and logs, so nothing you could still re-run is
// removed. The archive the current checkout points at is always kept.
//
// Usage: node scripts/prune-fixtures.js s3://<bucket> [--days 90]
// Needs the AWS CLI (read-only `aws s3 ls`). Run it where `aws` works for you.

const { spawnSync } = require('node:child_process');
const { repoRoot, readManifest } = require('./fixture-manifest');

const args = process.argv.slice(2);
const bucket = (args.find((arg) => arg.startsWith('s3://')) || '').replace(/\/+$/, '');
const daysIndex = args.indexOf('--days');
const days = daysIndex === -1 ? 90 : Number(args[daysIndex + 1]);

if (!bucket || !Number.isFinite(days)) {
    console.error('Usage: node scripts/prune-fixtures.js s3://<bucket> [--days 90]');
    process.exit(2);
}

function run(command, commandArgs) {
    const result = spawnSync(command, commandArgs, { cwd: repoRoot, encoding: 'utf8' });
    if (result.error) throw result.error;
    return result;
}

function archiveAt(revision) {
    const result = run('git', ['show', `${revision}:fixture-manifest.json`]);
    if (result.status !== 0) return null;
    try {
        return JSON.parse(result.stdout).archive || null;
    } catch {
        return null;
    }
}

const referenced = new Set([readManifest().archive]);

const tips = run('git', ['for-each-ref', '--format=%(objectname)']).stdout.split('\n');
const recent = run('git', [
    'log',
    '--all',
    `--since=${days}.days`,
    '--format=%H',
    '--',
    'fixture-manifest.json',
]).stdout.split('\n');
for (const revision of new Set([...tips, ...recent].filter(Boolean))) {
    const archive = archiveAt(revision);
    if (archive) referenced.add(archive);
}

const listing = run('aws', ['s3', 'ls', `${bucket}/`]);
if (listing.status !== 0) {
    console.error(listing.stderr || 'aws s3 ls failed');
    process.exit(1);
}
const stored = listing.stdout
    .split('\n')
    .map((line) => line.trim().split(/\s+/).pop())
    .filter((name) => /^fixture-.*\.tar\.gz$/.test(name));

const stale = stored.filter((name) => !referenced.has(name));
console.log(`Archives in ${bucket}: ${stored.length}, still referenced: ${referenced.size}`);
referenced.forEach((name) =>
    console.log(`  keep  ${name}${stored.includes(name) ? '' : '  (not in bucket!)'}`),
);

if (stale.length === 0) {
    console.log('Nothing to prune.');
} else {
    console.log('');
    console.log(`Not referenced by any manifest in the last ${days} days (run them yourself):`);
    stale.forEach((name) => console.log(`aws s3 rm ${bucket}/${name}`));
}
