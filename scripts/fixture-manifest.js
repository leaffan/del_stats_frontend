'use strict';

// Shared helpers for the fixture manifest (fixture-manifest.json): the list of
// data/ files the end-to-end tests need, with their hashes, plus the name of
// the archive that holds them. The archive is named after its content, so an
// older commit's manifest keeps pointing at exactly the data it was tested with.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(repoRoot, 'fixture-manifest.json');

function sha256File(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// files: [{ path, sha256, bytes }] sorted by path
function archiveNameFor(files) {
    const digest = crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex');
    return `fixture-${digest.slice(0, 16)}.tar.gz`;
}

function readManifest() {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

module.exports = { repoRoot, manifestPath, sha256File, archiveNameFor, readManifest };
