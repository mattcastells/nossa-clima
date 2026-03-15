# APK Updates via GitHub Releases

This project now uses GitHub Releases as the source of truth for Android updates.

The app flow is:

1. Query the public GitHub Releases API.
2. Find the highest valid tagged release with an APK asset.
3. Compare its build number with the installed APK.
4. Download the APK.
5. Open the Android system installer for user confirmation.

## Why GitHub is better here

- No Supabase storage usage for APK files.
- Works well for 1 or 2 users.
- Public GitHub Releases support release assets.
- Public GitHub repositories can use GitHub-hosted standard runners for free.

## Tag format

Use this exact format:

- `v1.0.0-b1`
- `v1.0.1-b2`
- `v1.1.0-b3`

Rules:

- `1.0.1` becomes the Android app version.
- `2` becomes `android.versionCode`.
- `versionCode` must always increase.

## Release flow

1. Commit normal work to `main`.
2. When you want to publish a mobile release, create a tag:
   - `git tag v1.0.1-b2`
3. Push the tag:
   - `git push origin v1.0.1-b2`
4. GitHub Actions builds the APK and creates a GitHub Release with the APK attached.
5. The installed app can detect that release and open the installer.

## First release for this repo

For the current source state, the first public APK release should be:

- `v0.1.0-b1`

Suggested command sequence:

1. Commit the current release-ready changes on `main`.
2. Push `main`.
3. Create the first release tag:
   - `git tag v0.1.0-b1`
4. Push the tag:
   - `git push origin v0.1.0-b1`
5. Wait for `.github/workflows/android-release.yml` to finish.
6. Download `nossa-clima-v0.1.0-b1.apk` from the generated GitHub Release.

Do not use a plain `0.1.0` tag here. The app update parser expects the build suffix (`-b1`, `-b2`, etc.) so it can compare Android build numbers correctly.

## Current configuration

- Public repo used by the app: `mattcastells/nossa-clima`
- Android package: `com.nossaclima.app`
- Current base `versionCode` in source: `1`

## Important implementation detail

The CI release currently signs the APK with the standard React Native debug keystore copied during prebuild.

For a small private deployment this is acceptable and keeps the flow zero-cost.

If later you want a stricter production setup, the next step is switching CI to a dedicated keystore secret.

## Android limitation

The app cannot install silently.

It can only download the APK and open the system installer. The user still confirms the install.
