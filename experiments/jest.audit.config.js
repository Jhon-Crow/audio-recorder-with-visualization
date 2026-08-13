/** Standalone Jest config for the issue #208 audit proofs. */
const base = require('../jest.config');
module.exports = {
  ...base,
  rootDir: '..',
  roots: ['<rootDir>/experiments'],
  testMatch: ['**/issue-208-audit-proofs.test.ts'],
};
