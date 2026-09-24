module.exports = ({ config }) => {
  return {
    ...config,
    name: "Quick Karya",
    slug: "quick-karya",
    owner: config?.owner || "sultanquickkaryas-team",
    version: "1.0.0",
    android: {
      package: "com.quickkarya.app",
      versionCode: 1,
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "CALL_PHONE"
      ]
    },
    extra: {
      ...(config?.extra || {}),
      eas: {
        ...(config?.extra?.eas || {}),
        projectId:
          process.env.EAS_PROJECT_ID ||
          config?.extra?.eas?.projectId ||
          "2914b087-2f1d-41fa-926f-ffd005769c8c"
      }
    }
  };
};