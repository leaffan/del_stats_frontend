#!/usr/bin/env node

/**
 * Validates that all routes defined in del_stats.js have corresponding template files.
 * Catches issues like deleted templates or typos in route definitions.
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const delStatsPath = path.join(repoRoot, 'js', 'del_stats.js');
const content = fs.readFileSync(delStatsPath, 'utf8');

// Extract all templateUrl values from route definitions
// Matches patterns like: templateUrl: 'home.html',
const templateUrlRegex = /templateUrl\s*:\s*['"]([^'"]+)['"]/g;
const templates = new Set();
let match;

while ((match = templateUrlRegex.exec(content)) !== null) {
    templates.add(match[1]);
}

// Check that all templates exist
let errors = [];

templates.forEach(template => {
    const filePath = path.join(repoRoot, template);
    if (!fs.existsSync(filePath)) {
        errors.push(`Missing template file: ${template}`);
    }
});

// Report results
if (errors.length === 0) {
    console.log(`✓ All ${templates.size} route templates found:`);
    Array.from(templates).sort().forEach(t => console.log(`  - ${t}`));
    process.exit(0);
} else {
    console.error('✗ Route validation failed:');
    errors.forEach(err => console.error(`  ${err}`));
    process.exit(1);
}
