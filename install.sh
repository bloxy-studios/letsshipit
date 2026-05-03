#!/usr/bin/env bash
set -euo pipefail

APP_NAME="shipit"
VERSION="${SHIPIT_VERSION:-latest}"
BASE_URL="${SHIPIT_RELEASE_BASE_URL:-https://github.com/<owner>/<repo>/releases/download}"

info() {
  printf '%s\n' "$*"
}

fail() {
  printf 'shipit install failed: %s\n' "$*" >&2
  exit 1
}

detect_os() {
  case "$(uname -s)" in
    Darwin) printf 'darwin' ;;
    Linux) printf 'linux' ;;
    *) fail "unsupported OS: $(uname -s)" ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64 | amd64) printf 'x64' ;;
    arm64 | aarch64) printf 'arm64' ;;
    *) fail "unsupported architecture: $(uname -m)" ;;
  esac
}

OS="$(detect_os)"
ARCH="$(detect_arch)"

if [ "$VERSION" = "latest" ]; then
  URL="${BASE_URL}/latest/${APP_NAME}-${OS}-${ARCH}"
else
  URL="${BASE_URL}/v${VERSION}/${APP_NAME}-${OS}-${ARCH}"
fi

if [ -w "/usr/local/bin" ]; then
  INSTALL_DIR="/usr/local/bin"
else
  INSTALL_DIR="${HOME}/.local/bin"
  mkdir -p "$INSTALL_DIR"
fi

TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

info "Downloading ${APP_NAME} for ${OS}/${ARCH}..."
info "URL: ${URL}"

# TODO: Replace the placeholder GitHub Releases URL with the real release URL
# once release artifacts are published.
curl -fsSL "$URL" -o "$TMP_FILE"
chmod +x "$TMP_FILE"
mv "$TMP_FILE" "${INSTALL_DIR}/${APP_NAME}"

info "${APP_NAME} installed successfully at ${INSTALL_DIR}/${APP_NAME}"
info ""
info "Next steps:"
info "  ${APP_NAME} --version"
info "  ${APP_NAME} config"

case ":$PATH:" in
  *":${INSTALL_DIR}:"*) ;;
  *)
    info ""
    info "Add ${INSTALL_DIR} to your PATH if '${APP_NAME}' is not found."
    ;;
esac
