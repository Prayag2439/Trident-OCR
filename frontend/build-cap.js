const { execSync } = require('child_process');

process.env.CAPACITOR_BUILD = 'true';

console.log('Building Next.js static export for Capacitor mobile app...');
execSync('npx next build', { stdio: 'inherit' });

console.log('Syncing web assets to native Android project...');
execSync('npx cap sync android', { stdio: 'inherit' });

console.log('\x1b[32m✔ Native Android mobile app assets updated successfully!\x1b[0m');
