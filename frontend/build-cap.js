const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

process.env.CAPACITOR_BUILD = 'true';

// Load variables from .env files (.env, .env.local, .env.production)
const envFiles = ['.env', '.env.local', '.env.production'];
envFiles.forEach(file => {
  const envPath = path.join(__dirname, file);
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx > 0) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    });
  }
});

// Target backend URL: use user-specified env or default to deployed production server
const targetBackendUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://trident-challan.corecotechnologies.com';
process.env.NEXT_PUBLIC_API_URL = targetBackendUrl;
process.env.NEXT_PUBLIC_BACKEND_URL = targetBackendUrl;

// Clean stale .next and out folders to ensure fresh build without chunk conflicts
const nextDir = path.join(__dirname, '.next');
const outDir = path.join(__dirname, 'out');
try {
  if (fs.existsSync(nextDir)) fs.rmSync(nextDir, { recursive: true, force: true });
  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
} catch (e) {
  console.warn('Notice: could not clear .next completely (may be in use by dev server). Continuing...');
}

console.log(`\x1b[36m➜ Building Next.js static export targeting backend: ${targetBackendUrl}\x1b[0m`);
execSync('npx next build', { stdio: 'inherit', env: process.env });

console.log('Syncing web assets to native Android project...');
execSync('npx cap sync android', { stdio: 'inherit', env: process.env });

console.log('\x1b[32m✔ Native Android mobile app assets updated successfully!\x1b[0m');

// Assemble APK and ensure it is named "Trident Fabricators.apk"
const androidDir = path.join(__dirname, 'android');
const javaHome = process.env.JAVA_HOME || 'C:\\Users\\praya\\.jdks\\jbr-21.0.11';
const gradlewCmd = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';

console.log(`\x1b[36m➜ Compiling Android APK named "Trident Fabricators"... \x1b[0m`);
try {
  execSync(`${gradlewCmd} assembleRelease assembleDebug`, {
    cwd: androidDir,
    stdio: 'inherit',
    env: { ...process.env, JAVA_HOME: javaHome },
  });

  const releaseApkDir = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release');
  const releaseSrc = path.join(releaseApkDir, 'Trident Fabricators-release.apk');
  const releaseDst = path.join(releaseApkDir, 'Trident Fabricators.apk');
  const rootReleaseDst = path.join(__dirname, 'Trident Fabricators.apk');

  if (fs.existsSync(releaseSrc)) {
    fs.copyFileSync(releaseSrc, releaseDst);
    fs.copyFileSync(releaseSrc, rootReleaseDst);
    console.log(`\x1b[32m✔ Release APK successfully generated: ${releaseDst}\x1b[0m`);
    console.log(`\x1b[32m✔ Convenient root copy: ${rootReleaseDst}\x1b[0m`);
  }
} catch (err) {
  console.warn('Warning: Could not compile APK directly via Gradle script:', err.message);
}

