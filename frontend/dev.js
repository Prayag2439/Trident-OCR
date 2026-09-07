const os = require('os');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const nextArgs = ['dev'];

let hasHostname = false;
let hasPort = false;
let port = '3000';

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--host' || arg === '-H' || arg === '--hostname') {
    hasHostname = true;
    const nextVal = args[i + 1];
    if (nextVal && !nextVal.startsWith('-')) {
      nextArgs.push('-H', nextVal);
      i++;
    } else {
      nextArgs.push('-H', '0.0.0.0');
    }
  } else if (arg.startsWith('--host=')) {
    hasHostname = true;
    nextArgs.push('-H', arg.split('=')[1]);
  } else if (arg.startsWith('--hostname=')) {
    hasHostname = true;
    nextArgs.push('-H', arg.split('=')[1]);
  } else if (arg === '-p' || arg === '--port') {
    hasPort = true;
    port = args[++i] || '3000';
    nextArgs.push('-p', port);
  } else {
    nextArgs.push(arg);
  }
}

if (!hasHostname) {
  nextArgs.push('-H', '0.0.0.0');
}
if (!hasPort) {
  nextArgs.push('-p', port);
}

// Resolve real network LAN IPs (exactly like Vite in Real-Time AI Prescription Digitizer)
function getLanIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const [name, ifaces] of Object.entries(interfaces)) {
    for (const iface of ifaces || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const isVirtual =
          name.toLowerCase().includes('virtual') ||
          name.toLowerCase().includes('vethernet') ||
          iface.address.startsWith('192.168.56.');
        ips.push({ ip: iface.address, name, isVirtual });
      }
    }
  }
  ips.sort((a, b) => (a.isVirtual === b.isVirtual ? 0 : a.isVirtual ? 1 : -1));
  return ips;
}

const lanIps = getLanIps();
const primaryLan = lanIps.find((i) => !i.isVirtual) || lanIps[0];

console.log('\n  \x1b[36m➜\x1b[0m  \x1b[1mLocal:\x1b[0m   \x1b[36mhttp://localhost:' + port + '/\x1b[0m');
if (primaryLan) {
  console.log(
    '  \x1b[36m➜\x1b[0m  \x1b[1mNetwork:\x1b[0m \x1b[36mhttp://' +
      primaryLan.ip +
      ':' +
      port +
      '/\x1b[0m \x1b[2m(' +
      primaryLan.name +
      ')\x1b[0m'
  );
}
console.log('  \x1b[2m(Note: http://0.0.0.0 is a bind meta-address; always use the Network URL above in browsers)\x1b[0m\n');

const nextBin = require.resolve('next/dist/bin/next');
const child = spawn(process.execPath, [nextBin, ...nextArgs], {
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
