import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export default ({ config } = {}) => {
  const baseConfig = config || {};
  const googleServicesPath = path.resolve(currentDir, 'google-services.json');
  const hasGoogleServicesFile = fs.existsSync(googleServicesPath);

  return {
    ...baseConfig,
    name: "Quick Karya",
    slug: "quick-karya",
    scheme: "quickkarya",
    owner: "sultanquickkaryas-team",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    icon: "./assets/icon.png",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#001F3F"
    },
    plugins: [
      [
        "@react-native-google-signin/google-signin",
        {
          "iosUrlScheme": "com.googleusercontent.apps.149463790904-u3gf07vile2kskuvad69fu7b18utm6pb"
        }
      ],
      "expo-notifications",
      [
        "expo-image-picker",
        {
          "photosPermission": "Quick Karya accesses your photo library so you can upload and crop your profile photo.",
          "cameraPermission": "Quick Karya uses your camera so you can take a profile photo."
        }
      ],
      [
        "expo-location",
        {
          "locationWhenInUsePermission": "Quick Karya uses your location to show nearby verified workers and share your service pin."
        }
      ]
    ],
    ios: {
      ...(baseConfig.ios || {}),
      bundleIdentifier: "com.quickkarya.app",
      buildNumber: "1",
      supportsTablet: true,
      infoPlist: {
        ...(baseConfig.ios?.infoPlist || {}),
        NSLocationWhenInUseUsageDescription: "Quick Karya uses your location to show nearby verified workers and share your service pin.",
        NSCameraUsageDescription: "Quick Karya uses your camera so you can take a profile photo.",
        NSPhotoLibraryUsageDescription: "Quick Karya accesses your photo library so you can upload and crop your profile photo."
      }
    },
    android: {
      ...(baseConfig.android || {}),
      package: "com.quickkarya.app",
      versionCode: 1,
      ...(hasGoogleServicesFile ? { googleServicesFile: "./google-services.json" } : {}),
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#001F3F"
      },
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "CALL_PHONE",
        "CAMERA",
        "POST_NOTIFICATIONS",
        "VIBRATE"
      ]
    },
    web: {
      ...(baseConfig.web || {}),
      favicon: "./assets/favicon.png"
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