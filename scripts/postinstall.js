/**
 * postinstall.js
 * Patches expo-modules-core, resolves Kotlin errors, fixes signatures, and C++ strictness.
 * This runs automatically after `npm install`.
 */
const fs = require('fs');
const path = require('path');

// --- Fix 1: Patch ExpoModulesCorePlugin.gradle (Maven publication error) ---
const gradlePluginPath = path.join(__dirname, '..', 'node_modules', 'expo-modules-core', 'android', 'ExpoModulesCorePlugin.gradle');
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
  if (content.includes(original)) {
    content = content.replace(original, patched);
    fs.writeFileSync(gradlePluginPath, content, 'utf8');
    console.log('[postinstall] Patched ExpoModulesCorePlugin.gradle');
  }
}

// --- Fix 2: Ensure hermesc is executable (Linux only) ---
if (require('os').platform() === 'linux') {
  const hermesPath = path.join(__dirname, '..', 'node_modules', 'react-native', 'sdks', 'hermesc', 'linux64-bin', 'hermesc');
  if (fs.existsSync(hermesPath)) {
    try { fs.chmodSync(hermesPath, '755'); } catch (e) { }
  }
}

// --- Fix 3: Patch PermissionsService.kt (Kotlin null-safety) ---
const permissionsServicePath = path.join(__dirname, '..', 'node_modules', 'expo-modules-core', 'android', 'src', 'main', 'java', 'expo', 'modules', 'adapters', 'react', 'permissions', 'PermissionsService.kt');
if (fs.existsSync(permissionsServicePath)) {
  let ktContent = fs.readFileSync(permissionsServicePath, 'utf8');
  const ktOriginalRegex = /return\s+requestedPermissions\.contains\(permission\)/;
  const ktPatched = 'return requestedPermissions?.contains(permission) == true';
  if (ktOriginalRegex.test(ktContent)) {
    ktContent = ktContent.replace(ktOriginalRegex, ktPatched);
    fs.writeFileSync(permissionsServicePath, ktContent, 'utf8');
    console.log('[postinstall] Patched PermissionsService.kt');
  }
}

// --- Fix 4: Patch autolinking_implementation.gradle (api -> implementation) ---
const autolinkingImplPath = path.join(__dirname, '..', 'node_modules', 'expo-modules-autolinking', 'scripts', 'android', 'autolinking_implementation.gradle');
if (fs.existsSync(autolinkingImplPath)) {
  let alContent = fs.readFileSync(autolinkingImplPath, 'utf8');
  if (alContent.includes("handler.add('api',")) {
    alContent = alContent.replace(/handler\.add\('api',/g, "handler.add('implementation',");
    fs.writeFileSync(autolinkingImplPath, alContent, 'utf8');
    console.log('[postinstall] Patched autolinking_implementation.gradle');
  }
}

// --- Fix 5: Patch ExpoLinkingModule.kt (Signature Mismatch) ---
const linkingModulePath = path.join(__dirname, '..', 'node_modules', 'expo-linking', 'android', 'src', 'main', 'java', 'expo', 'modules', 'linking', 'ExpoLinkingModule.kt');
if (fs.existsSync(linkingModulePath)) {
  let ktLinkContent = fs.readFileSync(linkingModulePath, 'utf8');
  const startObsRegex = /OnStartObserving\s*\(\s*"[^"]+"\s*\)/g;
  const stopObsRegex = /OnStopObserving\s*\(\s*"[^"]+"\s*\)/g;
  if (startObsRegex.test(ktLinkContent) || stopObsRegex.test(ktLinkContent)) {
    ktLinkContent = ktLinkContent.replace(startObsRegex, 'OnStartObserving');
    ktLinkContent = ktLinkContent.replace(stopObsRegex, 'OnStopObserving');
    fs.writeFileSync(linkingModulePath, ktLinkContent, 'utf8');
    console.log('[postinstall] Patched ExpoLinkingModule.kt');
  }
}

// --- Fix 6: Patch WorkletRuntimeDecorator.cpp (C++ VLA Error) ---
const workletDecoratorPath = path.join(__dirname, '..', 'node_modules', 'react-native-reanimated', 'Common', 'cpp', 'ReanimatedRuntime', 'WorkletRuntimeDecorator.cpp');
if (fs.existsSync(workletDecoratorPath)) {
  let cppContent = fs.readFileSync(workletDecoratorPath, 'utf8');

  // 1. Add <vector> include if missing
  if (!cppContent.includes('#include <vector>')) {
    cppContent = cppContent.replace('#include "WorkletRuntimeDecorator.h"', '#include "WorkletRuntimeDecorator.h"\n#include <vector>');
  }

  // 2. Replace VLA with std::vector
  const vlaMarker = 'jsi::Value args[argsSize]; // NOLINT(runtime/arrays)';
  if (cppContent.includes(vlaMarker)) {
    cppContent = cppContent.replace(
      'jsi::Value args[argsSize]; // NOLINT(runtime/arrays)',
      'std::vector<jsi::Value> args(argsSize); // VLA patched to vector'
    );

    // Replace the call site to use args.data() with explicit cast to avoid ambiguity
    if (cppContent.includes('.call(rt, args, argsSize);')) {
      cppContent = cppContent.replace('.call(rt, args, argsSize);', '.call(rt, (const jsi::Value*)args.data(), argsSize);');
    }

    fs.writeFileSync(workletDecoratorPath, cppContent, 'utf8');
    console.log('[postinstall] Patched WorkletRuntimeDecorator.cpp');
  }
}

// --- Fix 7: Patch NativeReanimatedModule.cpp (Implicit capture of 'this') ---
const nativeReanimatedModulePath = path.join(__dirname, '..', 'node_modules', 'react-native-reanimated', 'Common', 'cpp', 'NativeModules', 'NativeReanimatedModule.cpp');
if (fs.existsSync(nativeReanimatedModulePath)) {
  let content = fs.readFileSync(nativeReanimatedModulePath, 'utf8');
  if (!content.includes('pragma clang diagnostic ignored "-Wdeprecated-this-capture"')) {
    content = content.replace('#include "NativeReanimatedModule.h"', '#include "NativeReanimatedModule.h"\n\n#pragma clang diagnostic push\n#pragma clang diagnostic ignored "-Wdeprecated-this-capture"');
    fs.writeFileSync(nativeReanimatedModulePath, content, 'utf8');
    console.log('[postinstall] Patched NativeReanimatedModule.cpp (Supressed warnings)');
  }
}

// --- Fix 8: Operation Scorched Earth - Recursive 16KB Patching ---
const modulesToPatch = [
  'react-native-reanimated',
  'expo-modules-core',
  'react-native-screens',
  'react-native-gesture-handler',
  'react-native-svg',
  'react-native-safe-area-context',
  'react-native-video', // If present
  'react-native-image-picker' // If present
];

function findFiles(dir, filename, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        findFiles(filePath, filename, fileList);
      }
    } else if (file === filename) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const patchFlag = 'add_link_options("-Wl,-z,max-page-size=16384")';
const oldPatch = 'string(APPEND CMAKE_SHARED_LINKER_FLAGS " -Wl,-z,max-page-size=16384")';

modulesToPatch.forEach(moduleName => {
  const modulePath = path.join(__dirname, '..', 'node_modules', moduleName);
  if (fs.existsSync(modulePath)) {
    const cmakeFiles = findFiles(modulePath, 'CMakeLists.txt');
    cmakeFiles.forEach(cmakePath => {
      let content = fs.readFileSync(cmakePath, 'utf8');
      let patched = false;

      // Clean old patch
      if (content.includes(oldPatch)) {
        content = content.replace(oldPatch, '');
        patched = true;
      }

      // Inject new patch
      if (!content.includes('max-page-size=16384')) {
        if (content.includes('cmake_minimum_required')) {
          content = content.replace(/cmake_minimum_required\(.*\)/, '$&\n' + patchFlag);
        } else {
          content = patchFlag + '\n' + content;
        }
        patched = true;
      }

      if (patched) {
        fs.writeFileSync(cmakePath, content, 'utf8');
        console.log(`[postinstall] Patched 16KB Flag in: ${path.relative(path.join(__dirname, '..'), cmakePath)}`);
      }
    });
  }
});

// --- Fix 9: Scorched Earth - Repair @expo/cli Internal Resolution ---
const expoCliPath = path.join(__dirname, '..', 'node_modules', '@expo', 'cli', 'build');
if (fs.existsSync(expoCliPath)) {
  const jsFiles = findFiles(expoCliPath, '.js'); // Need a variation of findFiles or update yours
  // Actually, I'll update findFiles to support extension matching or just use it.
  
  // Updated findFiles-like loop for .js files
  const patchInternalImports = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
         patchInternalImports(filePath);
      } else if (file.endsWith('.js')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let altered = false;
        
        // Matches require("./something") or require("../something") without extension
        // This is a surgical regex to add .js to internal relative requires
        const requireRegex = /require\(\s*['"](\.\.?\/[^'"]+)(?<!\.js|[.\/])['"]\s*\)/g;
        if (requireRegex.test(content)) {
          content = content.replace(requireRegex, (match, p1) => {
             // Verify if it's a file, not a directory
             const targetPath = path.join(path.dirname(filePath), p1 + '.js');
             if (fs.existsSync(targetPath)) {
               altered = true;
               return `require("${p1}.js")`;
             }
             return match;
          });
        }
        
        if (altered) {
          fs.writeFileSync(filePath, content, 'utf8');
        }
      }
    }
  };
  
  try {
    patchInternalImports(expoCliPath);
    console.log('[postinstall] Applied scorched earth repair to @expo/cli imports');
  } catch (e) {
    console.error('[postinstall] Failed to apply scorched earth repair:', e.message);
  }
}
