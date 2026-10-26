/** A full-height card about a piece of hardware clicked on the map: facts with sources, pictures. */
import type { HardwareFacts } from '../core/hardware-facts'
import { el } from './dom'

const link = (href: string, text: string) =>
  el('a', { href, target: '_blank', rel: 'noopener', textContent: text })

export function openHardwareCard(f: HardwareFacts): void {
  const close = el('button', { type: 'button', className: 'gate-link', textContent: 'Close' })
  const dialog = el(
    'dialog',
    { className: 'hardware-card' },
    el('div', { className: 'hardware-card-bar' }, el('h2', { textContent: f.title }), close),
    el(
      'div',
      { className: 'hardware-card-body' },
      ...f.images.map((i) =>
        el(
          'figure',
          { className: 'edl-photo' },
          el('img', { src: i.src, alt: i.alt, loading: 'lazy', decoding: 'async' }),
          el('figcaption', { textContent: `${i.caption} ${i.credit}.` }),
        ),
      ),
      el(
        'ul',
        { className: 'hardware-facts' },
        ...f.facts.map((x) =>
          el(
            'li',
            {},
            `${x.text} `,
            el(
              'span',
              { className: 'feature-source' },
              '(',
              link(x.source.url, x.source.label),
              ')',
            ),
          ),
        ),
      ),
      el('h3', { className: 'feature-heading', textContent: 'Read more' }),
      el(
        'ul',
        { className: 'hardware-links' },
        ...f.links.map((l) => el('li', {}, link(l.url, l.label))),
      ),
    ),
  )
  dialog.setAttribute('aria-label', f.title)
  close.addEventListener('click', () => dialog.close())
  dialog.addEventListener('close', () => dialog.remove()) // Esc closes it natively
  document.body.append(dialog)
  dialog.showModal()
}
