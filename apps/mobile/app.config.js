export default {
  expo: {
    name: "DIRECTO",
    slug: "directo",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "directo",
    userInterfaceStyle: "light",
    newArchEnabled: false,
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.directo.app",
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    },
    android: {
      adaptiveIcon: {
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
  },
};
