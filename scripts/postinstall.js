/**
 * postinstall.js
 * Patches expo-modules-core, fixes Hermes permissions, resolves Kotlin errors, and fixes dependency scope.
 * This runs automatically after `npm install` on EAS Cloud.
 */
const fs = require('fs');
const path = require('path');

// --- Fix 1: Patch ExpoModulesCorePlugin.gradle (components.release error) ---
const gradlePluginPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-modules-core',
  'android',
  'ExpoModulesCorePlugin.gradle'
);

if (fs.existsSync(gradlePluginPath)) {
  let content = fs.readFileSync(gradlePluginPath, 'utf8');

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
  } else if (content.includes(original)) {
    content = content.replace(original, patched);
    fs.writeFileSync(gradlePluginPath, content, 'utf8');
    console.log('[postinstall] Successfully patched ExpoModulesCorePlugin.gradle.');
  } else {
    console.log('[postinstall] WARNING: Could not find target text in ExpoModulesCorePlugin.gradle to patch.');
  }
} else {
  console.log('[postinstall] ExpoModulesCorePlugin.gradle not found.');
}

// --- Fix 2: Ensure hermesc is executable (Linux only, for EAS) ---
const platform = require('os').platform();
if (platform === 'linux') {
  console.log('[postinstall] Running on Linux. Attempting to fix hermesc permissions.');

  let hermesPath;
  try {
    const rnPath = path.dirname(require.resolve('react-native/package.json'));
    hermesPath = path.join(rnPath, 'sdks', 'hermesc', 'linux64-bin', 'hermesc');
  } catch (error) {
    console.error('[postinstall] Failed to resolve react-native path:', error.message);
    hermesPath = path.join(__dirname, '..', 'node_modules', 'react-native', 'sdks', 'hermesc', 'linux64-bin', 'hermesc');
  }

  if (fs.existsSync(hermesPath)) {
    try {
      fs.chmodSync(hermesPath, '755');
      console.log('[postinstall] Successfully set permissions for hermesc.');
    } catch (error) {
      console.error('[postinstall] Failed to set permissions for hermesc:', error.message);
    }
  } else {
    console.error('[postinstall] CRITICAL: hermesc binary NOT FOUND at:', hermesPath);
  }
}

// --- Fix 3: Patch PermissionsService.kt (Kotlin null-safety error) ---
const permissionsServicePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-modules-core',
  'android',
  'src',
  'main',
  'java',
  'expo',
  'modules',
  'adapters',
  'react',
  'permissions',
  'PermissionsService.kt'
);

if (fs.existsSync(permissionsServicePath)) {
  let ktContent = fs.readFileSync(permissionsServicePath, 'utf8');

  // Regex to match ignoring whitespace
  const ktOriginalRegex = /return\s+requestedPermissions\.contains\(permission\)/;
  const ktPatched = 'return requestedPermissions?.contains(permission) == true';

  if (ktOriginalRegex.test(ktContent)) {
    ktContent = ktContent.replace(ktOriginalRegex, ktPatched);
    fs.writeFileSync(permissionsServicePath, ktContent, 'utf8');
    console.log('[postinstall] Successfully patched PermissionsService.kt (null-safety fix).');
  } else if (ktContent.includes(ktPatched)) {
    console.log('[postinstall] PermissionsService.kt already patched.');
  } else {
    console.log('[postinstall] WARNING: Could not find target code in PermissionsService.kt to patch.');
    const snippetIndex = ktContent.indexOf('getPackageInfo');
    if (snippetIndex !== -1) {
      console.log('Snippet around getPackageInfo:', ktContent.substring(snippetIndex, snippetIndex + 200));
    }
  }
} else {
  console.log('[postinstall] PermissionsService.kt not found at:', permissionsServicePath);
}

// --- Fix 4: Patch autolinking_implementation.gradle (Fix 'cannot find symbol' in :expo) ---
const autolinkingImplPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-modules-autolinking',
  'scripts',
  'android',
  'autolinking_implementation.gradle'
);

if (fs.existsSync(autolinkingImplPath)) {
  let alContent = fs.readFileSync(autolinkingImplPath, 'utf8');
  // Replace "handler.add('api', dependency)" with "handler.add('implementation', dependency)"
  // We do this for both occurrences (lines ~301 and ~303)
  const alOriginal = /handler\.add\('api',/g;
  const alPatched = "handler.add('implementation',";

  if (alContent.match(alOriginal)) {
    alContent = alContent.replace(alOriginal, alPatched);
    fs.writeFileSync(autolinkingImplPath, alContent, 'utf8');
    console.log('[postinstall] Successfully patched autolinking_implementation.gradle (switched api -> implementation).');
  } else if (alContent.includes("handler.add('implementation',")) {
    console.log('[postinstall] autolinking_implementation.gradle already patched.');
  } else {
    console.log('[postinstall] WARNING: Could not find "handler.add(\'api\'," in autolinking_implementation.gradle.');
  }
} else {
  console.log('[postinstall] autolinking_implementation.gradle not found at:', autolinkingImplPath);
}
