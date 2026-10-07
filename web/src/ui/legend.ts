/** Legend swatches: each is the layer's actual map symbol, drawn as a 20x20 SVG. */
import { LAYER_STYLE, type LayerId } from '../map/layers'

const svg = (body: string) =>
  `<svg class="swatch" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">${body}</svg>`

export const SWATCHES: Record<LayerId, string> = {
  molaShade: svg(
    '<defs><linearGradient id="mola" x1="0" x2="1"><stop offset="0" stop-color="#2b3fbf"/><stop offset=".5" stop-color="#3fbf5a"/><stop offset="1" stop-color="#f4f1ee"/></linearGradient></defs><rect x="2" y="2" width="16" height="16" rx="2" fill="url(#mola)"/>',
  ),
  tesDust: svg(
    '<rect x="2" y="2" width="16" height="16" rx="2" fill="#6b4a2f"/><circle cx="7" cy="8" r="2" fill="#e8c9a0"/><circle cx="13" cy="12" r="2.5" fill="#e8c9a0" opacity=".7"/>',
  ),
  thermal: svg(
    '<defs><linearGradient id="ti" x1="0" x2="1"><stop offset="0" stop-color="#0d366b"/><stop offset=".5" stop-color="#3987e5"/><stop offset="1" stop-color="#cde2fb"/></linearGradient></defs><rect x="2" y="2" width="16" height="16" rx="2" fill="url(#ti)"/>',
  ),
  roughness: svg(
    '<rect x="2" y="2" width="16" height="16" rx="2" fill="#20263a"/><path d="M3 13l3-4 2 3 3-6 2 5 2-2 2 4" fill="none" stroke="#c9d2e6" stroke-width="1.4"/>',
  ),
  imagery: svg(
    '<rect x="2" y="2" width="16" height="16" rx="2" fill="#8C7A6B"/><path d="M2 13l5-4 4 3 3-2 4 3v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" fill="#5E5146"/>',
  ),
  slopeHazard: svg(
    `<defs><pattern id="hz" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="4" fill="${LAYER_STYLE.hazard}"/></pattern></defs><rect x="2" y="2" width="16" height="16" rx="2" fill="url(#hz)" stroke="${LAYER_STYLE.hazard}"/>`,
  ),
  traverses: svg(
    `<path d="M2 15c4-1 4-9 8-9s3 7 8 5" fill="none" stroke="${LAYER_STYLE.perseverance}" stroke-width="2.5" stroke-linecap="round"/>`,
  ),
  streetview: svg(
    `<circle cx="6" cy="13" r="3" fill="${LAYER_STYLE.perseverance}" stroke="#05070C"/><circle cx="14" cy="7" r="3" fill="${LAYER_STYLE.curiosity}" stroke="#05070C"/><path d="M6 13L14 7" stroke="rgba(255,255,255,.5)" stroke-dasharray="2 2"/>`,
  ),
  samples: svg(
    `<path d="M10 2.5L17.5 10 10 17.5 2.5 10Z" fill="${LAYER_STYLE.sample}" stroke="#05070C" stroke-width="1.5"/>`,
  ),
  landingSites: svg(
    `<circle cx="7" cy="10" r="3.5" fill="${LAYER_STYLE.landed}"/><circle cx="15" cy="10" r="2.6" fill="none" stroke="${LAYER_STYLE.crashed}" stroke-width="1.6"/>`,
  ),
  names: svg(
    '<circle cx="5" cy="14" r="2" fill="#E8ECF4"/><rect x="9" y="5" width="9" height="2.5" rx="1" fill="#E8ECF4"/><rect x="9" y="10" width="6" height="2.5" rx="1" fill="#E8ECF4" opacity=".6"/>',
  ),
  zones: svg(
    `<circle cx="10" cy="10" r="7" fill="none" stroke="${LAYER_STYLE.zone}" stroke-width="2"/>`,
  ),
  graticule: svg(
    '<path d="M2 7h16M2 13h16M7 2v16M13 2v16" stroke="rgba(255,255,255,.55)" stroke-width="1.2"/>',
  ),
}
