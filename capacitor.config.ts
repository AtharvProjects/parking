import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.santwamanbhau.parking',
  appName: 'Sant Wamanbhau Parking',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: false,
      iosKeychainPrefix: 'sant-wamanbhau-sqlite',
      iosBiometric: {
        biometricAuth: false,
        biometricTitle: 'Biometric login for sqlite'
      },
      androidIsEncryption: false,
      androidBiometric: {
        biometricAuth: false,
        biometricTitle: 'Biometric login for sqlite'
      },
      electronWindowsLocation: 'C:\\ProgramData\\CapacitorDatabases',
      electronMacLocation: '/Users/Shared/CapacitorDatabases',
      electronLinuxLocation: 'Databases'
    }
  }
};

export default config;
