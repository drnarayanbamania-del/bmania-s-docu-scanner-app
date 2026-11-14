#!/usr/bin/env node
/**
 * Points the generated Android release build at the project's release keystore.
 *
 * `expo prebuild` regenerates android/app/build.gradle with the shared debug
 * keystore, which is not usable for distribution or for updates. This patch is
 * idempotent: running it twice leaves the file unchanged.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const gradlePath = path.join(root, 'android/app/build.gradle');

if (!fs.existsSync(gradlePath)) {
  console.error('android/app/build.gradle not found - run `npx expo prebuild --platform android` first.');
  process.exit(1);
}

let gradle = fs.readFileSync(gradlePath, 'utf8');
const MARKER = '// release signing config (deploy/android/apply-signing.js)';

if (gradle.includes(MARKER)) {
  console.log('Signing config already applied.');
  process.exit(0);
}

const propertiesBlock = `
${MARKER}
def keystorePropertiesFile = rootProject.file("../deploy/android/keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
`;

// Place the properties load right after the plugin block so it is available to
// the android { } configuration below.
const pluginEnd = gradle.indexOf('\n', gradle.lastIndexOf('apply plugin:'));
if (pluginEnd === -1) {
  console.error('Could not find the plugin block in android/app/build.gradle.');
  process.exit(1);
}
gradle = gradle.slice(0, pluginEnd + 1) + propertiesBlock + gradle.slice(pluginEnd + 1);

const debugSigning = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;

if (!gradle.includes(debugSigning)) {
  console.error('Could not find the debug signingConfigs block to extend.');
  process.exit(1);
}

gradle = gradle.replace(
  debugSigning,
  `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile rootProject.file("../" + keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }`
);

const releaseSigning = `            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;

if (!gradle.includes(releaseSigning)) {
  console.error('Could not find the release buildType signingConfig line.');
  process.exit(1);
}

gradle = gradle.replace(releaseSigning, '            signingConfig signingConfigs.release');

fs.writeFileSync(gradlePath, gradle);
console.log('Applied the release signing config to android/app/build.gradle.');
