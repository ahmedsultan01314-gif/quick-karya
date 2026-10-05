export default ({ config } = {}) => {
  const baseConfig = config || {};
  return {
    ...baseConfig,
    name: "Quick Karya",
    slug: "quick-karya",
    owner: "sultanquickkaryas-team",
    version: "1.0.0",
    icon: "./assets/icon.png",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#064e3b"
    },
    android: {
      ...(baseConfig.android || {}),
      package: "com.quickkarya.app",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#064e3b"
      },
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "CALL_PHONE"
      ]
    },
    extra: {
      ...(baseConfig.extra || {}),
      eas: {
        ...(baseConfig.extra?.eas || {}),
        projectId: "2914b087-2f1d-41fa-926f-ffd005769c8c"
      }
    }
  };
};