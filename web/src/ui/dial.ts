/** An analogue dial with a needle, the Space Age Console's basic instrument. */
import { svg } from './sol-visuals'
import { el } from './dom'

const START_DEG = 135
const SWEEP_DEG = 270
const CENTRE = 60
const TICKS = 10

/** Where the needle points for a share of full scale. */
export function needleAngleDeg(share: number): number {
  const s = Number.isFinite(share) ? Math.min(1, Math.max(0, share)) : 0
  return START_DEG + SWEEP_DEG * s
}

export type Dial = HTMLElement & { update: (share: number, reading: string) => void }

export function dial(o: { label: string; share: number; reading: string; tone?: string }): Dial {
  const face = svg('svg', { viewBox: '0 0 120 120', class: 'dial-face', 'aria-hidden': 'true' })
  for (let i = 0; i <= TICKS; i++) {
    const major = i % 5 === 0
    const a = (needleAngleDeg(i / TICKS) * Math.PI) / 180
    const outer = 54
    const inner = major ? 44 : 49
    face.append(
      svg('line', {
        x1: CENTRE + outer * Math.cos(a),
        y1: CENTRE + outer * Math.sin(a),
        x2: CENTRE + inner * Math.cos(a),
        y2: CENTRE + inner * Math.sin(a),
        class: 'dial-tick',
        'stroke-width': major ? 3 : 2,
      }),
    )
  }
  const needle = svg('line', {
    x1: CENTRE,
    y1: CENTRE,
    x2: CENTRE + 42,
    y2: CENTRE,
    class: 'dial-needle',
    'stroke-width': 4,
    'stroke-linecap': 'round',
  })
  face.append(needle, svg('circle', { cx: CENTRE, cy: CENTRE, r: 6, class: 'dial-hub' }))
  const value = el('b', { className: 'dial-value' })
  const root = el(
    'div',
    { className: 'dial' },
    face,
    el('span', { className: 'dial-label', textContent: o.label }),
    value,
  ) as unknown as Dial
  root.setAttribute('role', 'img')
  if (o.tone) root.style.setProperty('--dial-tone', o.tone)
  root.update = (share, reading) => {
    needle.setAttribute('transform', `rotate(${needleAngleDeg(share)} ${CENTRE} ${CENTRE})`)
    value.textContent = reading
    root.setAttribute('aria-label', `${o.label}: ${reading}`)
  }
  root.update(o.share, o.reading)
  return root
}
