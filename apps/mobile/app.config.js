export default {
  expo: {
    name: "DIRECTO",
    slug: "directo",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "directo",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    icon: "./assets/icon.png",
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.directo.app",
      icon: "./assets/icon.png",
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
        backgroundColor: "#2563EB",
      },
      softwareKeyboardLayoutMode: "pan",
      package: "com.directo.app",
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
    },
    web: {
      bundler: "metro",
      output: "single",
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      "@react-native-community/datetimepicker",
    ],
    extra: {
      eas: {
        projectId: "97bdd240-7a17-45b8-9055-ef20e1ef5ee3",
      },
    },
    owner: "jona2909",
  },
};
