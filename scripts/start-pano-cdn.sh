#!/usr/bin/env bash
# Serve data/pano/ as a public CDN via Cloudflare Tunnel.
# Run this on the laptop during the demo. The tunnel URL is printed below.
#
# One-time install (if cloudflared not found):
#   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
#   sudo dpkg -i /tmp/cloudflared.deb
#
# After starting, copy the trycloudflare.com URL printed by cloudflared and set:
#   VITE_PANO_CDN=https://xyz.trycloudflare.com   in web/.env
# Then: cd web && npm run build && git add web/dist... (or just push to trigger Vercel).
# Vercel redeploys automatically on push — update .env BEFORE pushing.

set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
PANO_DIR="$REPO/data/pano"
PORT=9876

if [[ ! -d "$PANO_DIR" ]]; then
  echo "ERROR: $PANO_DIR not found. Run the pipeline first." >&2
  exit 1
fi

echo "==> Serving $PANO_DIR on port $PORT"
echo "==> Starting Cloudflare Tunnel..."
echo ""

# Start file server in background
npx serve "$PANO_DIR" --cors -l "$PORT" &
SERVE_PID=$!
trap "kill $SERVE_PID 2>/dev/null" EXIT

sleep 1  # let serve start

# Start tunnel (quick tunnel, no CF account needed)
cloudflared tunnel --url "http://localhost:$PORT"
