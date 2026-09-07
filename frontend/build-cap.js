const { execSync } = require('child_process');

process.env.CAPACITOR_BUILD = 'true';

// Target backend URL: use user-specified env or default to deployed production server
const targetBackendUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://47.129.188.226';
process.env.NEXT_PUBLIC_API_URL = targetBackendUrl;
process.env.NEXT_PUBLIC_BACKEND_URL = targetBackendUrl;

console.log(`\x1b[36m➜ Building Next.js static export targeting backend: ${targetBackendUrl}\x1b[0m`);
execSync('npx next build', { stdio: 'inherit', env: process.env });

console.log('Syncing web assets to native Android project...');
execSync('npx cap sync android', { stdio: 'inherit', env: process.env });

console.log('\x1b[32m✔ Native Android mobile app assets updated successfully!\x1b[0m');
