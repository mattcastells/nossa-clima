import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

import { env } from '@/lib/env';

const APK_MIME_TYPE = 'application/vnd.android.package-archive';
const FLAG_GRANT_READ_URI_PERMISSION = 0x00000001;
const FLAG_ACTIVITY_NEW_TASK = 0x10000000;
const UNKNOWN_SOURCES_ACTION = 'android.settings.MANAGE_UNKNOWN_APP_SOURCES';
const DEFAULT_GITHUB_REPO = 'mattcastells/nossa-clima';
const GITHUB_API_VERSION = '2022-11-28';
const RELEASE_TAG_PATTERN = /^v(?<version>\d+\.\d+\.\d+)-b(?<buildNumber>\d+)$/i;

const VERSION_PATTERN = /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$/;

export interface AppUpdateRelease {
  tagName: string;
  repo: string;
  version: string;
  buildNumber: number;
  apkUrl: string;
  assetName: string;
  notes?: string;
  publishedAt?: string;
}

export type AppUpdateStatus =
  | 'up-to-date'
  | 'update-available'
  | 'newer-release-blocked-by-build'
  | 'cannot-check-installed-build';

interface GitHubReleaseAsset {
  name?: unknown;
  browser_download_url?: unknown;
}

interface GitHubRelease {
  tag_name?: unknown;
  body?: unknown;
  published_at?: unknown;
  draft?: unknown;
  prerelease?: unknown;
  assets?: unknown;
}

const requireAndroid = () => {
  if (Platform.OS !== 'android') {
    throw new Error('La instalacion directa de actualizaciones solo funciona en Android.');
  }
};

export const getUpdateRepository = (): string => {
  return env.appUpdateGitHubRepo ?? DEFAULT_GITHUB_REPO;
};

const parsePositiveInteger = (value: unknown, fieldName: string): number => {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Manifest de actualizacion invalido: ${fieldName}.`);
  }
  return parsed;
};

const parseReleaseTag = (tagName: string): { version: string; buildNumber: number } | null => {
  const match = RELEASE_TAG_PATTERN.exec(tagName);

  if (!match?.groups) {
    return null;
  }

  const { version, buildNumber } = match.groups;

  if (!version || !buildNumber) {
    return null;
  }

  return {
    version,
    buildNumber: parsePositiveInteger(buildNumber, 'buildNumber'),
  };
};

const parseVersionParts = (version: string): [number, number, number] | null => {
  const match = VERSION_PATTERN.exec(version);

  if (!match?.groups) {
    return null;
  }

  const major = Number.parseInt(match.groups.major ?? '', 10);
  const minor = Number.parseInt(match.groups.minor ?? '', 10);
  const patch = Number.parseInt(match.groups.patch ?? '', 10);

  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) {
    return null;
  }

  return [major, minor, patch];
};

const compareSemanticVersions = (left: string, right: string): number => {
  const leftParts = parseVersionParts(left);
  const rightParts = parseVersionParts(right);

  if (!leftParts || !rightParts) {
    return 0;
  }

  if (leftParts[0] !== rightParts[0]) {
    return leftParts[0] - rightParts[0];
  }

  if (leftParts[1] !== rightParts[1]) {
    return leftParts[1] - rightParts[1];
  }

  return leftParts[2] - rightParts[2];
};

const normalizeGitHubRelease = (raw: unknown, repo: string): AppUpdateRelease | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const release = raw as GitHubRelease;

  if (release.draft === true || release.prerelease === true) {
    return null;
  }

  const tagName = typeof release.tag_name === 'string' ? release.tag_name.trim() : '';
  const parsedTag = tagName ? parseReleaseTag(tagName) : null;

  if (!parsedTag) {
    return null;
  }

  const assets = Array.isArray(release.assets) ? (release.assets as GitHubReleaseAsset[]) : [];
  const apkAsset = assets.find(
    (asset) => typeof asset.name === 'string'
      && asset.name.toLowerCase().endsWith('.apk')
      && typeof asset.browser_download_url === 'string',
  );

  if (!apkAsset || typeof apkAsset.name !== 'string' || typeof apkAsset.browser_download_url !== 'string') {
    return null;
  }

  const notes = typeof release.body === 'string' ? release.body.trim() || undefined : undefined;
  const publishedAt = typeof release.published_at === 'string' ? release.published_at.trim() || undefined : undefined;

  return {
    tagName,
    repo,
    version: parsedTag.version,
    buildNumber: parsedTag.buildNumber,
    apkUrl: apkAsset.browser_download_url,
    assetName: apkAsset.name,
    ...(notes ? { notes } : {}),
    ...(publishedAt ? { publishedAt } : {}),
  };
};

const getDownloadTargetUri = (buildNumber: number): string => {
  const baseDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!baseDirectory) {
    throw new Error('No se encontro un directorio local para descargar la actualizacion.');
  }
  return `${baseDirectory}app-updates/nossa-clima-${buildNumber}.apk`;
};

export const getCurrentBuildNumber = (): number | null => {
  const nativeBuildVersion = Application.nativeBuildVersion;
  if (!nativeBuildVersion) {
    return null;
  }

  const parsed = Number.parseInt(nativeBuildVersion, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getCurrentVersionLabel = (): string => {
  const version = Application.nativeApplicationVersion ?? 'dev';
  const build = Application.nativeBuildVersion ?? 'dev';
  return `${version} (${build})`;
};

export const getCurrentApplicationVersion = (): string | null => {
  return Application.nativeApplicationVersion ?? null;
};

export const fetchAppUpdateRelease = async (): Promise<AppUpdateRelease> => {
  const repo = getUpdateRepository();
  const response = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=100`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`No se encontro el repo o no tiene releases publicas: ${repo}.`);
    }

    if (response.status === 403) {
      throw new Error('GitHub rechazo la consulta de releases. Probablemente se alcanzo el rate limit publico.');
    }

    throw new Error(`No se pudo leer la release de GitHub. HTTP ${response.status}.`);
  }

  const raw = await response.json();
  if (!Array.isArray(raw)) {
    throw new Error('Respuesta invalida de GitHub Releases.');
  }

  const releases = raw
    .map((item) => normalizeGitHubRelease(item, repo))
    .filter((item): item is AppUpdateRelease => Boolean(item))
    .sort((left, right) => {
      const versionComparison = compareSemanticVersions(right.version, left.version);
      if (versionComparison !== 0) {
        return versionComparison;
      }

      return right.buildNumber - left.buildNumber;
    });

  if (releases.length === 0) {
    throw new Error('No hay releases validas con APK en GitHub.');
  }

  const latestRelease = releases[0];

  if (!latestRelease) {
    throw new Error('No se pudo determinar la release mas reciente.');
  }

  return latestRelease;
};

export const isAppUpdateAvailable = (release: AppUpdateRelease): boolean => {
  return getAppUpdateStatus(release) === 'update-available';
};

export const getAppUpdateStatus = (release: AppUpdateRelease): AppUpdateStatus => {
  const currentBuildNumber = getCurrentBuildNumber();
  if (currentBuildNumber == null) {
    return 'cannot-check-installed-build';
  }

  if (release.buildNumber > currentBuildNumber) {
    return 'update-available';
  }

  const installedVersion = getCurrentApplicationVersion();
  if (installedVersion && compareSemanticVersions(release.version, installedVersion) > 0) {
    return 'newer-release-blocked-by-build';
  }

  return 'up-to-date';
};

export const openUnknownSourcesSettings = async (): Promise<void> => {
  requireAndroid();

  const applicationId = Application.applicationId;
  const params = applicationId ? { data: `package:${applicationId}` } : undefined;

  try {
    await IntentLauncher.startActivityAsync(UNKNOWN_SOURCES_ACTION, params);
  } catch {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.SECURITY_SETTINGS);
  }
};

export const downloadAndInstallAppUpdate = async (
  release: AppUpdateRelease,
  onProgress?: (progressPercent: number) => void,
): Promise<void> => {
  requireAndroid();

  const targetUri = getDownloadTargetUri(release.buildNumber);
  const updatesDirectory = targetUri.slice(0, targetUri.lastIndexOf('/'));

  await FileSystem.makeDirectoryAsync(updatesDirectory, { intermediates: true });
  await FileSystem.deleteAsync(targetUri, { idempotent: true });

  const downloadTask = FileSystem.createDownloadResumable(
    release.apkUrl,
    targetUri,
    {},
    (progress) => {
      if (!onProgress || progress.totalBytesExpectedToWrite <= 0) {
        return;
      }

      const percent = Math.round((progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100);
      onProgress(percent);
    },
  );

  const result = await downloadTask.downloadAsync();

  if (!result?.uri) {
    throw new Error('No se pudo descargar la APK de actualizacion.');
  }

  const contentUri = await FileSystem.getContentUriAsync(result.uri);

  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: APK_MIME_TYPE,
    flags: FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK,
  });
};
