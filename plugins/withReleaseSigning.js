// Release signing for the APK, from environment variables set by the GitHub build (never stored in the repo):
//   XIFO_KEYSTORE (path), XIFO_KEYSTORE_PASSWORD, XIFO_KEY_ALIAS, XIFO_KEY_PASSWORD.
// Without them (a local test build) the release APK is signed with the debug key, as Expo does by default.
const { withAppBuildGradle } = require('expo/config-plugins');

const BLOCK = `
        release {
            if (System.getenv("XIFO_KEYSTORE")) {
                storeFile file(System.getenv("XIFO_KEYSTORE"))
                storePassword System.getenv("XIFO_KEYSTORE_PASSWORD")
                keyAlias System.getenv("XIFO_KEY_ALIAS")
                keyPassword System.getenv("XIFO_KEY_PASSWORD")
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (!g.includes('XIFO_KEYSTORE')) {
      g = g.replace(/signingConfigs\s*\{/, (m) => m + BLOCK);
      g = g.replace(/(release\s*\{[^}]*?)signingConfig\s+signingConfigs\.debug/s,
        '$1signingConfig System.getenv("XIFO_KEYSTORE") ? signingConfigs.release : signingConfigs.debug');
    }
    cfg.modResults.contents = g;
    return cfg;
  });
};
