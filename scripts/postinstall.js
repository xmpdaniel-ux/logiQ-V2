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
  const hermesPath = path.join(
    __dirname,
    '..',
    'node_modules',
    'react-native',
    'sdks',
    'hermesc',
    'linux64-bin',
    'hermesc'
  );

  if (fs.existsSync(hermesPath)) {
    try {
      fs.chmodSync(hermesPath, '755');
      console.log('[postinstall] Successfully set permissions for hermesc.');
    } catch (error) {
      console.error('[postinstall] Failed to set permissions for hermesc:', error);
    }
  } else {
    console.log('[postinstall] hermesc not found at expected path (skipping chmod):', hermesPath);
  }
}
