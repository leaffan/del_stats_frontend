'use strict';

// Thin wrapper around @playwright/test's `test`. When HARVEST_FIXTURE_DIR is
// set, every test's browser context records a HAR file into that directory,
// which scripts/build-test-fixture.js then mines for the exact data/ and
// cfg/ URLs the active test suite touches. Behaves identically to plain
// `require('@playwright/test')` otherwise.

const base = require('@playwright/test');
const path = require('path');

const harvestDir = process.env.HARVEST_FIXTURE_DIR;

const test = harvestDir
    ? base.test.extend({
          context: async ({ browser }, use, testInfo) => {
              const context = await browser.newContext({
                  recordHar: {
                      path: path.join(harvestDir, `${testInfo.testId}.har`),
                      content: 'omit',
                  },
              });
              await use(context);
              await context.close();
          },
      })
    : base.test;

module.exports = { test, expect: base.expect };
