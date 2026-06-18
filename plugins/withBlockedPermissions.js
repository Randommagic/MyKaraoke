const { withAndroidManifest } = require("expo/config-plugins");

const BLOCKED = [
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  "android.permission.SYSTEM_ALERT_WINDOW",
];

module.exports = (config) =>
  withAndroidManifest(config, (modConfig) => {
    const existing = modConfig.modResults.manifest["uses-permission"] ?? [];
    modConfig.modResults.manifest["uses-permission"] = existing.filter(
      (p) => !BLOCKED.includes(p.$?.["android:name"] ?? ""),
    );
    return modConfig;
  });
