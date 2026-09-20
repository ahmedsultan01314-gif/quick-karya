module.exports = ({ config }) => {
  const projectId =
    process.env.EAS_PROJECT_ID ||
    config?.extra?.eas?.projectId ||
    "8d4e9070-a57f-4d06-8aeb-64ed1b0d7856";

  return {
    ...config,
    name: config?.name || "Quick Karya",
    slug: config?.slug || "quick-karya",
    owner: config?.owner || "sultanquickkarya",
    version: config?.version || "1.0.0",
    android: {
      package: "com.quickkarya.app",
      versionCode: 1,
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "CALL_PHONE"
      ],
      ...(config?.android || {})
    },
    extra: {
      ...(config?.extra || {}),
      eas: {
        ...(config?.extra?.eas || {}),
        projectId: projectId
      }
    }
  };
};
