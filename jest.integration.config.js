// Integration tests run in plain Node (real fetch, no React Native mocks) against a local
// Supabase. See src/__integration__.
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src/__integration__'],
  transform: { '\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
