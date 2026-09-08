import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.optimo360.challan',
  appName: 'Trident Fabricators',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      '*',
      'trident-challan.corecotechnologies.com'
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
