#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('${ROOT_DIR}/package.json').version")"
PACKAGE_DIR="${1:-}"

if [ -z "${PACKAGE_DIR}" ] || [ ! -f "${PACKAGE_DIR}/RELEASE.txt" ]; then
  echo "Usage: $0 <unified-package-directory>" >&2
  exit 1
fi

OUTPUT="${PACKAGE_DIR}/ios"
TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/timemanage-ios-release.XXXXXX")"
ARCHIVE_PATH="${TEMP_DIR}/TimeManage.xcarchive"
EXPORT_PATH="${TEMP_DIR}/export"
FAKE_BIN="${TEMP_DIR}/bin"

cleanup() {
  rm -rf "${TEMP_DIR}"
}
trap cleanup EXIT

cd "${ROOT_DIR}"
npm run verify:ios:release
node scripts/validate-ios-store-metadata.mjs
npm run build:ios
cargo build --manifest-path src-tauri/Cargo.toml --target aarch64-apple-ios --release --lib
mkdir -p src-tauri/gen/apple/Externals/arm64/release
cp src-tauri/target/aarch64-apple-ios/release/libtimemanage_desktop_lib.a \
  src-tauri/gen/apple/Externals/arm64/release/libapp.a
rsync -a --delete dist/ src-tauri/gen/apple/assets/
xcodegen generate --spec src-tauri/gen/apple/project.yml

mkdir -p "${FAKE_BIN}"
printf '#!/bin/sh\nexit 0\n' > "${FAKE_BIN}/npm"
chmod +x "${FAKE_BIN}/npm"
PATH="${FAKE_BIN}:${PATH}" xcodebuild \
  -project src-tauri/gen/apple/timemanage-desktop.xcodeproj \
  -scheme timemanage-desktop_iOS \
  -configuration release \
  -destination 'generic/platform=iOS' \
  -archivePath "${ARCHIVE_PATH}" \
  -allowProvisioningUpdates \
  archive
xcodebuild \
  -exportArchive \
  -archivePath "${ARCHIVE_PATH}" \
  -exportPath "${EXPORT_PATH}" \
  -exportOptionsPlist src-tauri/gen/apple/ExportOptions.plist \
  -allowProvisioningUpdates

rm -rf deploy/app-store-screenshots
npm run screenshots:ios:store

APP_PLIST="${ARCHIVE_PATH}/Products/Applications/TimeManage.app/Info.plist"
APP_VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "${APP_PLIST}")"
APP_BUILD="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "${APP_PLIST}")"
APP_BUNDLE="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "${APP_PLIST}")"
if [ "${APP_VERSION}" != "${VERSION}" ] || [ "${APP_BUILD}" != "2026071201" ] || [ "${APP_BUNDLE}" != "xyz.hudashuai.timemanage" ]; then
  echo "Unexpected archived app identity: ${APP_BUNDLE} ${APP_VERSION} (${APP_BUILD})" >&2
  exit 1
fi

rm -rf "${OUTPUT}"
mkdir -p "${OUTPUT}/app-store"
cp "${EXPORT_PATH}/TimeManage.ipa" "${OUTPUT}/TimeManage.ipa"
ditto "${ARCHIVE_PATH}" "${OUTPUT}/TimeManage.xcarchive"
cp -R app-store/metadata "${OUTPUT}/app-store/metadata"
cp app-store/privacy-data-draft.md "${OUTPUT}/app-store/"
cp app-store/review-notes-draft.md "${OUTPUT}/app-store/"
cp -R deploy/app-store-screenshots "${OUTPUT}/app-store/screenshots"

COMMIT="$(git rev-parse HEAD)"
cat > "${OUTPUT}/RELEASE-IOS.txt" <<EOF
TimeManage iOS release preparation
Version: ${VERSION}
Build: 2026071201
Bundle ID: xyz.hudashuai.timemanage
Extension Bundle ID: xyz.hudashuai.timemanage.TimerLiveActivity
Production API: https://www.hudashuai.xyz/timemanage-team/api/
Commit: ${COMMIT}
Archive: TimeManage.xcarchive
IPA: TimeManage.ipa
Human gates: privacy policy, review account/contact, legal declarations, real-device acceptance
EOF

find "${OUTPUT}" -type f -exec shasum -a 256 {} \; > "${OUTPUT}/SHA256SUMS.txt"
cat >> "${PACKAGE_DIR}/RELEASE.txt" <<EOF

iOS:
  ios/TimeManage.ipa
  ios/TimeManage.xcarchive
  ios/app-store/        screenshots, metadata, privacy and review drafts
EOF
echo "${OUTPUT}"
