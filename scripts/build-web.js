#!/usr/bin/env node
/**
 * Exports the app for web.
 *
 * `expo export --platform web` refuses to bundle when expo-router and
 * @react-navigation are both installed (SDK 56+). This app uses
 * @react-navigation directly and does not use expo-router, so the check is
 * disabled here instead of relying on the caller to export the variable.
 * Same flag netlify.toml sets for deploys.
 */
process.env.EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK = '1';

const { spawnSync } = require('child_process');

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['expo', 'export', '--platform', 'web', ...process.argv.slice(2)];

const result = spawnSync(npx, args, { stdio: 'inherit', env: process.env });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
