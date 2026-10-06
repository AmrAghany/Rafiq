/// <reference types="node" />
import fs from 'node:fs';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { generateSeed, seedPath } = require('../../../../scripts/seed.js');

it('supabase/seed.sql is up to date with the plan data (run npm run db:seed:generate)', () => {
  expect(fs.readFileSync(seedPath, 'utf8')).toBe(generateSeed());
});
