// Simple script to run the historical data fetch with proper path resolution
require('dotenv').config();
const { spawn } = require('child_process');

// Run the TypeScript script using ts-node with tsconfig-paths
const child = spawn('npx', [
  'ts-node',
  '-r', 'tsconfig-paths/register',
  'src/scripts/fetchOpenStatesDataHistorical.ts'
], {
  stdio: 'inherit'
});

child.on('error', (error) => {
  console.error(`Error running script: ${error.message}`);
  process.exit(1);
});

child.on('close', (code) => {
  process.exit(code);
});
