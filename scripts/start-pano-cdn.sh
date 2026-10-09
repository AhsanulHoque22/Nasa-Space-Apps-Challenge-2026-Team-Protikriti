#!/usr/bin/env bash
# Serve data/pano/ publicly from this laptop.
#
# Permanent address (recommended): a free ngrok static domain.
#   1. Sign up at https://dashboard.ngrok.com, copy your authtoken, then once:
#        ngrok config add-authtoken <token>
#   2. Dashboard -> Domains -> create your free domain (like name-word-123.ngrok-free.app).
#   3. Run:  NGROK_URL=name-word-123.ngrok-free.app scripts/start-pano-cdn.sh
#   4. Once: set VITE_PANO_CDN=https://name-word-123.ngrok-free.app in web/.env and in Vercel
#      (production), then redeploy. The address never changes after that.
#
# Without NGROK_URL this falls back to a Cloudflare quick tunnel, whose address is new every run
# (then VITE_PANO_CDN must be updated and redeployed each time).

set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
PANO_DIR="$REPO/data/pano"
PORT=9876

if [[ ! -d "$PANO_DIR" ]]; then
  echo "ERROR: $PANO_DIR not found. Run the pipeline first." >&2
  exit 1
fi

echo "==> Serving $PANO_DIR on port $PORT"
npx serve "$PANO_DIR" --cors -l "$PORT" &
SERVE_PID=$!
trap 'kill $SERVE_PID 2>/dev/null' EXIT
sleep 1

if [[ -n "${NGROK_URL:-}" ]]; then
  echo "==> Permanent address: https://$NGROK_URL"
  ngrok http --url="$NGROK_URL" "$PORT"
else
  echo "==> No NGROK_URL set: using a temporary Cloudflare quick tunnel"
  cloudflared tunnel --url "http://localhost:$PORT"
fi
