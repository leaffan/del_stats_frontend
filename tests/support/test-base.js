'use strict';

// Thin wrapper around @playwright/test's `test`. When HARVEST_FIXTURE_DIR is
// set, every test's browser context records a HAR file into that directory,
// and every page.request.* call (HEAD/GET existence checks, which a HAR does
// not contain) is appended to a sidecar .api.txt file. scripts/build-test-fixture.js
// mines both for the exact data/ and cfg/ URLs the active test suite touches.
// Behaves identically to plain `require('@playwright/test')` otherwise.

const base = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const harvestDir = process.env.HARVEST_FIXTURE_DIR;
const API_METHODS = ['get', 'head', 'fetch', 'post', 'put', 'patch', 'delete'];

const test = harvestDir
    ? base.test.extend({
          context: async ({ browser }, use, testInfo) => {
              const context = await browser.newContext({
                  recordHar: {
                      path: path.join(harvestDir, `${testInfo.testId}.har`),
                      content: 'omit',
                  },
              });
              const apiLog = path.join(harvestDir, `${testInfo.testId}.api.txt`);
              for (const method of API_METHODS) {
                  const original = context.request[method].bind(context.request);
                  context.request[method] = (url, ...rest) => {
                      fs.appendFileSync(apiLog, `${typeof url === 'string' ? url : url.url()}\n`);
                      return original(url, ...rest);
                  };
              }
              await use(context);
              await context.close();
          },
      })
    : base.test;

// Skips the current test when its fixture file is missing - unless
// REQUIRE_FIXTURE is set (CI), where a missing file must fail the test loudly
// instead of letting a run go green without having checked anything.
function requireData(available, what) {
    if (available) return;
    if (process.env.REQUIRE_FIXTURE) {
        throw new Error(`Data fixtures missing: ${what}`);
    }
    test.skip();
}

module.exports = { test, expect: base.expect, requireData };
