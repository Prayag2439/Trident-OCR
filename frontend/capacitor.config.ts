import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.optimo360.challan',
  appName: 'Trident Fabricators',
  webDir: 'out',
  server: {
    androidScheme: 'http',
    cleartext: true,
    allowNavigation: [
      '*'
    ]
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
  android: {
    allowMixedContent: true,
  }
};

export default config;
