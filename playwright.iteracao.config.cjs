'use strict';

const base = require('./playwright.config.cjs');

module.exports = {
  ...base,
  reporter: [
    ['list'],
    ['json', { outputFile: 'e2e/reports/testes-results.json' }],
  ],
  projects: [
    base.projects[0],
    {
      name: 'iteracao',
      dependencies: ['setup'],
      retries: 0,
      testMatch: /iteracao\/.*\.spec\.js$/,
      use: { storageState: 'e2e/.state/qa-session.json' },
    },
  ],
};
