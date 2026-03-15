import fs from 'node:fs';
import path from 'node:path';

const tagName = process.argv[2];
const tagPattern = /^v(\d+\.\d+\.\d+)-b(\d+)$/i;

if (!tagName) {
  console.error('Missing tag name. Expected format: v1.0.1-b2');
  process.exit(1);
}

const match = tagPattern.exec(tagName);

if (!match) {
  console.error(`Invalid tag "${tagName}". Expected format: v1.0.1-b2`);
  process.exit(1);
}

const [, version, versionCodeRaw] = match;
const versionCode = Number.parseInt(versionCodeRaw, 10);

if (!Number.isFinite(versionCode) || versionCode <= 0) {
  console.error(`Invalid build number in tag "${tagName}".`);
  process.exit(1);
}

const appJsonPath = path.resolve('app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

appJson.expo.version = version;
appJson.expo.android = {
  ...(appJson.expo.android ?? {}),
  versionCode,
};

fs.writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`);

console.log(`Prepared Android release ${tagName}`);
console.log(`version=${version}`);
console.log(`versionCode=${versionCode}`);
