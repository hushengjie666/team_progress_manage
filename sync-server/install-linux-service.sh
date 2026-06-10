#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/timemanage-sync}"
CONFIG_DIR="${CONFIG_DIR:-/etc/timemanage-sync}"
DATA_DIR="${DATA_DIR:-/var/lib/timemanage-sync}"
SERVICE_FILE="/etc/systemd/system/timemanage-sync.service"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root: sudo INSTALL_DIR=${INSTALL_DIR} CONFIG_DIR=${CONFIG_DIR} DATA_DIR=${DATA_DIR} $0"
  exit 1
fi

id -u timemanage >/dev/null 2>&1 || useradd --system --home "${DATA_DIR}" --shell /usr/sbin/nologin timemanage
mkdir -p "${INSTALL_DIR}" "${CONFIG_DIR}" "${DATA_DIR}"
cp ./bin/timemanage-sync "${INSTALL_DIR}/timemanage-sync"
chmod 0755 "${INSTALL_DIR}/timemanage-sync"

if [[ ! -f "${CONFIG_DIR}/sync.json" ]]; then
  cp ./config.example.json "${CONFIG_DIR}/sync.json"
  sed -i.bak "s#sync-server/data/store.json#${DATA_DIR}/store.json#g" "${CONFIG_DIR}/sync.json" || true
fi

cp ./timemanage-sync.service.example "${SERVICE_FILE}"
chown -R timemanage:timemanage "${DATA_DIR}"
systemctl daemon-reload
systemctl enable --now timemanage-sync
systemctl status timemanage-sync --no-pager
