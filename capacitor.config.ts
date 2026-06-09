import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ru.liststock.app",
  appName: "ListStock",
  webDir: "dist/spa",
  // Для работы с локальным сервером замените на реальный URL сервера
  server: {
    // url: "https://ваш-домен.ru",  // для production
    // androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#ffffff",
      showSpinner: false,
    },
    StatusBar: {
      style: "DEFAULT",
    },
  },
  android: {
    buildOptions: {
      keystorePath: "keystore/liststock.keystore",
      keystorePassword: "changeme",
      keystoreAlias: "liststock",
      keystoreAliasPassword: "changeme",
      releaseType: "APK",
    },
  },
};

export default config;
