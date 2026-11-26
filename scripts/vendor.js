#!/usr/bin/env node
'use strict';

// Copies the third-party runtime libraries the app loads in the browser from
// node_modules/ into vendor/, which is committed: the site is deployed with a
// plain `git pull` and has no build step, so the files have to be in the repo.
// The versions come from the exactly pinned "dependencies" in package.json, so
// Dependabot can propose updates; vendor/ itself never names a version, so an
// update does not touch index.html.
//
// Usage: node scripts/vendor.js [--check]
//   (no flag)  rebuild vendor/ from node_modules/ (removes files no longer listed)
//   --check    do not write anything, fail if vendor/ differs from what a rebuild
//              would produce (meant for CI, right after `pnpm install`)

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const vendorRoot = path.join(repoRoot, 'vendor');

// One entry per npm package: the folder it gets below vendor/, and the files to
// copy, as [path inside the package, path inside that folder]. Only what the
// pages actually load, plus the licence, which MIT, OFL and CC BY require to
// ship alongside the files.
const PACKAGES = [
    {
        name: 'angular',
        dir: 'angular',
        files: [
            ['angular.min.js', 'angular.min.js'],
            ['LICENSE.md', 'LICENSE.md'],
        ],
    },
    {
        name: 'angular-route',
        dir: 'angular-route',
        files: [
            ['angular-route.min.js', 'angular-route.min.js'],
            ['LICENSE.md', 'LICENSE.md'],
        ],
    },
    {
        name: 'bootstrap',
        dir: 'bootstrap',
        files: [
            ['dist/css/bootstrap.min.css', 'css/bootstrap.min.css'],
            ['LICENSE', 'LICENSE'],
        ],
    },
    {
        // all.min.css loads its fonts from ../webfonts/, so the two folders
        // keep the package's own layout; js/all.min.js is the SVG variant
        // used by scorer-race/.
        name: '@fortawesome/fontawesome-free',
        dir: 'fontawesome',
        files: [
            ['css/all.min.css', 'css/all.min.css'],
            ['js/all.min.js', 'js/all.min.js'],
            ['webfonts/fa-brands-400.ttf', 'webfonts/fa-brands-400.ttf'],
            ['webfonts/fa-brands-400.woff2', 'webfonts/fa-brands-400.woff2'],
            ['webfonts/fa-regular-400.ttf', 'webfonts/fa-regular-400.ttf'],
            ['webfonts/fa-regular-400.woff2', 'webfonts/fa-regular-400.woff2'],
            ['webfonts/fa-solid-900.ttf', 'webfonts/fa-solid-900.ttf'],
            ['webfonts/fa-solid-900.woff2', 'webfonts/fa-solid-900.woff2'],
            ['webfonts/fa-v4compatibility.ttf', 'webfonts/fa-v4compatibility.ttf'],
            ['webfonts/fa-v4compatibility.woff2', 'webfonts/fa-v4compatibility.woff2'],
            ['LICENSE.txt', 'LICENSE.txt'],
        ],
    },
    {
        name: 'moment',
        dir: 'moment',
        files: [
            ['min/moment-with-locales.min.js', 'moment-with-locales.min.js'],
            ['LICENSE', 'LICENSE'],
        ],
    },
    {
        name: 'twix',
        dir: 'twix',
        files: [
            ['dist/twix.min.js', 'twix.min.js'],
            ['LICENSE.md', 'LICENSE.md'],
        ],
    },
    {
        name: 'ngstorage',
        dir: 'ngstorage',
        files: [
            ['ngStorage.min.js', 'ngStorage.min.js'],
            ['LICENSE', 'LICENSE'],
        ],
    },
    {
        name: 'angular-moment',
        dir: 'angular-moment',
        files: [
            ['angular-moment.min.js', 'angular-moment.min.js'],
            ['LICENSE', 'LICENSE'],
        ],
    },
    {
        name: 'angular-moment-picker',
        dir: 'angular-moment-picker',
        files: [
            ['dist/angular-moment-picker.min.js', 'angular-moment-picker.min.js'],
            ['dist/angular-moment-picker.min.css', 'angular-moment-picker.min.css'],
            ['LICENSE', 'LICENSE'],
        ],
    },
    {
        name: 'd3',
        dir: 'd3',
        files: [
            ['dist/d3.min.js', 'd3.min.js'],
            ['LICENSE', 'LICENSE'],
        ],
    },
];

function toPosix(p) {
    return p.split(path.sep).join('/');
}

function listFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) =>
            toPosix(path.relative(vendorRoot, path.join(entry.parentPath, entry.name))),
        );
}

// Every package in PACKAGES must be a pinned dependency, and node_modules must
// hold exactly that version. Otherwise a stale install (say, after Dependabot
// bumped package.json but before `pnpm install`) would silently vendor the old
// files.
function checkVersions(errors) {
    const pkgJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    const deps = pkgJson.dependencies || {};
    for (const { name } of PACKAGES) {
        const wanted = deps[name];
        if (!wanted) {
            errors.push(`${name}: missing from "dependencies" in package.json`);
            continue;
        }
        if (!/^\d+\.\d+\.\d+$/.test(wanted)) {
            errors.push(`${name}: "${wanted}" in package.json is not an exact version`);
            continue;
        }
        // Read the manifest by path rather than require.resolve(): packages
        // with an "exports" map (d3) do not expose package.json.
        const manifest = path.join(repoRoot, 'node_modules', name, 'package.json');
        if (!fs.existsSync(manifest)) {
            errors.push(`${name}: not installed, run pnpm install`);
            continue;
        }
        const installed = JSON.parse(fs.readFileSync(manifest, 'utf8')).version;
        if (installed !== wanted) {
            errors.push(
                `${name}: node_modules has ${installed}, package.json wants ${wanted}, run pnpm install`,
            );
        }
    }
    const listed = new Set(PACKAGES.map((p) => p.name));
    for (const name of Object.keys(deps)) {
        if (!listed.has(name)) {
            errors.push(`${name}: in "dependencies" but not vendored by scripts/vendor.js`);
        }
    }
}

// Maps each vendor/ path to the node_modules file it comes from.
function plannedFiles(errors) {
    const planned = new Map();
    for (const pkg of PACKAGES) {
        const pkgRoot = path.join(repoRoot, 'node_modules', pkg.name);
        for (const [from, to] of pkg.files) {
            const source = path.join(pkgRoot, from);
            if (!fs.existsSync(source)) {
                errors.push(`${pkg.name}: ${from} does not exist in the installed package`);
                continue;
            }
            planned.set(`${pkg.dir}/${to}`, source);
        }
    }
    return planned;
}

function fail(errors) {
    for (const error of errors) console.error(`  ${error}`);
    process.exit(1);
}

const check = process.argv.includes('--check');
const errors = [];
checkVersions(errors);
const planned = plannedFiles(errors);
if (errors.length) {
    console.error('vendor: cannot proceed:');
    fail(errors);
}

if (check) {
    const present = new Set(listFiles(vendorRoot));
    for (const [target, source] of planned) {
        if (!present.has(target)) {
            errors.push(`missing: vendor/${target}`);
        } else if (
            !fs.readFileSync(source).equals(fs.readFileSync(path.join(vendorRoot, target)))
        ) {
            errors.push(`differs: vendor/${target}`);
        }
        present.delete(target);
    }
    for (const extra of present) errors.push(`not listed in scripts/vendor.js: vendor/${extra}`);
    if (errors.length) {
        console.error('vendor/ is out of date, run pnpm run vendor');
        fail(errors);
    }
    console.log(`vendor/ is up to date (${planned.size} files).`);
} else {
    fs.rmSync(vendorRoot, { recursive: true, force: true });
    for (const [target, source] of planned) {
        const dest = path.join(vendorRoot, target);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(source, dest);
    }
    console.log(`vendor/ rebuilt (${planned.size} files).`);
}
