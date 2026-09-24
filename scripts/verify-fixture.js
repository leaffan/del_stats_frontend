#!/usr/bin/env node
'use strict';

// Checks that data/ matches fixture-manifest.json exactly: every listed file
// present with the recorded hash, and nothing else in there. Meant for CI right
// after the fixture archive has been extracted into a clean checkout. Against a
// real, locally populated data/ it is not useful: the backend keeps changing
// those files, and the manifest only covers the subset the tests read.
//
// Usage: node scripts/verify-fixture.js [--allow-extra] [--root <dir>]
//   --allow-extra  do not fail on files that are in data/ but not in the manifest
//   --root <dir>   directory that contains data/ (default: repository root)

const fs = require('node:fs');
const path = require('node:path');
const { repoRoot, readManifest, sha256File } = require('./fixture-manifest');

const args = process.argv.slice(2);
const allowExtra = args.includes('--allow-extra');
const rootIndex = args.indexOf('--root');
const root = rootIndex === -1 ? repoRoot : path.resolve(args[rootIndex + 1]);

function listFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) =>
            path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'),
        );
}

const manifest = readManifest();
const expected = new Map(manifest.files.map((file) => [file.path, file]));

const missing = [];
const changed = [];
for (const file of manifest.files) {
    const onDisk = path.join(root, file.path);
    if (!fs.existsSync(onDisk)) {
        missing.push(file.path);
    } else if (fs.statSync(onDisk).size !== file.bytes || sha256File(onDisk) !== file.sha256) {
        changed.push(file.path);
    }
}
const extra = listFiles(path.join(root, 'data')).filter((file) => !expected.has(file));

function report(label, files) {
    if (files.length === 0) return;
    console.error(`${label} (${files.length}):`);
    files.forEach((file) => console.error(`  ${file}`));
}

report('Missing from data/', missing);
report('Changed compared to the manifest', changed);
if (!allowExtra) report('In data/ but not in the manifest', extra);

const failed = missing.length > 0 || changed.length > 0 || (!allowExtra && extra.length > 0);
if (failed) {
    console.error(`Fixture does not match fixture-manifest.json (archive ${manifest.archive}).`);
    process.exit(1);
}
console.log(`Fixture matches fixture-manifest.json: ${manifest.files.length} files verified.`);
