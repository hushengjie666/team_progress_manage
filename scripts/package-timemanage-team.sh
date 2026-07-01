#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_ROOT="${TM_DEPLOY_ROOT:-${ROOT_DIR}/deploy}"
PACKAGE_VERSION="${TM_PACKAGE_VERSION:-$(node -p "require('./package.json').version")}"
PACKAGE_STAMP="${TM_PACKAGE_STAMP:-$(date +%Y%m%d-%H%M%S)}"
PACKAGE_NAME="timemanageTeam-v${PACKAGE_VERSION}-${PACKAGE_STAMP}"
PACKAGE_DIR="${DEPLOY_ROOT}/${PACKAGE_NAME}"
BUILD_DIR="${TMPDIR:-/tmp}/timemanage-sync-win2008-build"
GO120_IMAGE="${GO120_IMAGE:-golang:1.20-bookworm}"
GIT_COMMIT="${TM_RELEASE_COMMIT:-$(git rev-parse --short=12 HEAD 2>/dev/null || true)}"
GIT_TAG="${TM_RELEASE_TAG:-$(git describe --exact-match --tags HEAD 2>/dev/null || true)}"
GIT_DIRTY="unknown"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  GIT_DIRTY="clean"
  if ! git diff --quiet --ignore-submodules -- || ! git diff --cached --quiet --ignore-submodules --; then
    GIT_DIRTY="dirty"
  fi
fi

cd "${ROOT_DIR}"
mkdir -p "${DEPLOY_ROOT}"

echo "[TimeManage] Building frontend for /timemanage-team/ ..."
rm -rf dist
npm run build -- --base=/timemanage-team/

rm -rf "${PACKAGE_DIR}"
mkdir -p "${PACKAGE_DIR}/web-release" "${PACKAGE_DIR}/sync/release"
rsync -a --delete dist/ "${PACKAGE_DIR}/web-release/"

if ! command -v docker >/dev/null 2>&1; then
  echo "[TimeManage] Docker is required to build the Windows Server 2008 compatible backend." >&2
  exit 1
fi

echo "[TimeManage] Building Windows Server 2008 compatible backend with ${GO120_IMAGE} ..."
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"
rsync -a --delete sync-server/ "${BUILD_DIR}/"
docker run --rm -v "${BUILD_DIR}:/src" -w /src "${GO120_IMAGE}" sh -lc '
  /usr/local/go/bin/go mod edit -go=1.20
  /usr/local/go/bin/go get github.com/go-sql-driver/mysql@v1.8.1 golang.org/x/sys@v0.16.0 golang.org/x/crypto@v0.17.0
  /usr/local/go/bin/go mod tidy
  GOOS=windows GOARCH=amd64 /usr/local/go/bin/go build -trimpath -ldflags="-s -w" -o bin/timemanage-sync-win2008.exe .
'

cp "${BUILD_DIR}/bin/timemanage-sync-win2008.exe" "${PACKAGE_DIR}/sync/release/timemanage-sync.exe"
cp sync-server/install-windows-service.ps1 "${PACKAGE_DIR}/sync/install-windows-service.ps1"
cp sync-server/config.example.json "${PACKAGE_DIR}/sync/sync.example.json"
cp sync-server/upgrade-backend.bat "${PACKAGE_DIR}/upgrade.bat"
cp sync-server/rollback-backend.bat "${PACKAGE_DIR}/rollback.bat"

rm -f "${PACKAGE_DIR}/sync/sync.json"

cat >"${PACKAGE_DIR}/RELEASE.txt" <<EOF
TimeManage Team ${PACKAGE_VERSION}
Build: ${PACKAGE_STAMP}
Git tag: ${GIT_TAG:-none}
Git commit: ${GIT_COMMIT:-unknown}
Git tree: ${GIT_DIRTY}

Default live project folder:
  ..\timemanageTeam

Recommended unzip location:
  C:\Users\Administrator\Desktop\

Compatibility:
  Upgrades old timemanageTeam-no-root deployments with web\ and sync\timemanage-sync.exe.
  If this release folder is accidentally unzipped inside the live timemanageTeam folder,
  upgrade.bat will use the parent folder as the live project folder.

Upgrade:
  double click upgrade.bat

Rollback:
  double click rollback.bat

If your live project folder is not a sibling named timemanageTeam, pass it as the first argument:
  upgrade.bat C:\Users\Administrator\Desktop\timemanageTeam
  rollback.bat C:\Users\Administrator\Desktop\timemanageTeam
EOF

cd "${DEPLOY_ROOT}"
rm -f "${DEPLOY_ROOT}/${PACKAGE_NAME}.zip"
find "${PACKAGE_NAME}" -name ".DS_Store" -delete
COPYFILE_DISABLE=1 zip -Xqr "${DEPLOY_ROOT}/${PACKAGE_NAME}.zip" "${PACKAGE_NAME}"

echo "[TimeManage] Package ready: ${DEPLOY_ROOT}/${PACKAGE_NAME}.zip"
echo "[TimeManage] Zip root folder: ${PACKAGE_NAME}/"
echo "[TimeManage] Upload next to the live timemanageTeam folder, unzip, then run ${PACKAGE_NAME}/upgrade.bat."
