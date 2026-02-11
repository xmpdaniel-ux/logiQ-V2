/**
 * postinstall.js
 * Patches expo-modules-core to fix 'components.release' error on Gradle 8.3
 * This runs automatically after `npm install` on EAS Cloud.
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-modules-core',
  'android',
  'ExpoModulesCorePlugin.gradle'
);

if (!fs.existsSync(filePath)) {
  console.log('[postinstall] ExpoModulesCorePlugin.gradle not found, skipping patch.');
  process.exit(0);
}

let content = fs.readFileSync(filePath, 'utf8');

const original = `        release(MavenPublication) {
          from components.release
        }`;

const patched = `        if (components.findByName('release')) {
          release(MavenPublication) {
            from components.release
          }
        }`;

if (content.includes('components.findByName')) {
  console.log('[postinstall] ExpoModulesCorePlugin.gradle already patched.');
  process.exit(0);
}

if (!content.includes(original)) {
  console.log('[postinstall] WARNING: Could not find target text to patch. File may have changed.');
  process.exit(0);
}

content = content.replace(original, patched);
fs.writeFileSync(filePath, content, 'utf8');
console.log('[postinstall] Successfully patched ExpoModulesCorePlugin.gradle (components.release safe check).');

// --- Fix 2: Ensure hermesc is executable (Linux only, for EAS) ---
const platform = require('os').platform();
if (platform === 'linux') {
  console.log('[postinstall] Running on Linux. Attempting to fix hermesc permissions.');

  let hermesPath;
  try {
    // Robustly find react-native package root
    const rnPath = path.dirname(require.resolve('react-native/package.json'));
    hermesPath = path.join(rnPath, 'sdks', 'hermesc', 'linux64-bin', 'hermesc');
    console.log('[postinstall] Resolved react-native path:', rnPath);
    console.log('[postinstall] Target hermesc path:', hermesPath);
  } catch (error) {
    console.error('[postinstall] Failed to resolve react-native path:', error);
    // Fallback to relative path if resolution fails
    hermesPath = path.join(__dirname, '..', 'node_modules', 'react-native', 'sdks', 'hermesc', 'linux64-bin', 'hermesc');
    console.log('[postinstall] Falling back to relative path:', hermesPath);
  }

  if (fs.existsSync(hermesPath)) {
    try {
      // Log current stats
      const stats = fs.statSync(hermesPath);
      console.log('[postinstall] Current hermesc permissions:', (stats.mode & 0o777).toString(8));

      // Force executable permissions
      fs.chmodSync(hermesPath, '755');

      // Verify change
      const newStats = fs.statSync(hermesPath);
      console.log('[postinstall] New hermesc permissions:', (newStats.mode & 0o777).toString(8));
      console.log('[postinstall] Successfully set permissions for hermesc.');
    } catch (error) {
      console.error('[postinstall] Failed to set permissions for hermesc:', error);
    }
  } else {
    console.error('[postinstall] CRITICAL: hermesc binary NOT FOUND at:', hermesPath);
    // Debug: List contents of sdks directory if possible
    try {
      const sdksDir = path.dirname(path.dirname(hermesPath));
      if (fs.existsSync(sdksDir)) {
        console.log(`[postinstall] Contents of ${sdksDir}:`, fs.readdirSync(sdksDir));
        const linuxBin = path.join(sdksDir, 'hermesc', 'linux64-bin');
        if (fs.existsSync(linuxBin)) {
          console.log(`[postinstall] Contents of ${linuxBin}:`, fs.readdirSync(linuxBin));
        }
      }
    } catch (e) {
      console.error('[postinstall] Error listing directories:', e);
    }
  }
}
