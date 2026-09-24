'use strict';

const js = require('@eslint/js');
const globals = require('globals');

// Report-only baseline: everything is a warning, never an error, so `pnpm lint`
// stays green even on this legacy codebase. Tighten individual rules to
// "error" once the underlying violations have actually been cleaned up.
function asWarnings(rules) {
    return Object.fromEntries(
        Object.entries(rules).map(([name, value]) => {
            if (value === 'error') return [name, 'warn'];
            if (Array.isArray(value) && value[0] === 'error')
                return [name, ['warn', ...value.slice(1)]];
            return [name, value];
        }),
    );
}

module.exports = [
    {
        ignores: [
            'node_modules/**',
            'data/**',
            'del-stats-angular/**',
            'playwright-report/**',
            'test-results/**',
            'po/**',
            // vendored third-party scripts, not project code
            'js/angular*.min.js',
            'js/moment-with-locales.min.js',
            'js/twix.js',
        ],
    },
    {
        ...js.configs.recommended,
        rules: asWarnings(js.configs.recommended.rules),
    },
    {
        files: ['js/**/*.js'],
        languageOptions: {
            sourceType: 'script',
            globals: {
                ...globals.browser,
                angular: 'readonly',
                // `app` is declared once in del_stats.js and shared across all
                // controller files via plain <script> tags (no module system)
                app: 'writable',
                moment: 'readonly',
                // defined in clinched_status.js, loaded via <script> before del_stats.js
                ClinchedStatus: 'readonly',
                FormatUtils: 'readonly',
            },
        },
    },
    {
        files: ['tests/**/*.js', 'scripts/**/*.js', '*.config.js', 'eslint.config.js'],
        languageOptions: {
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
            },
        },
    },
];
