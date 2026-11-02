/** An episode's title card: the hard cut before a mission. The player moves on; nothing times out. */
import type { Mission } from '../core/missions'
import { actOf, episodeField } from '../core/story-acts'
import { crewSilhouette } from './crew-silhouette'
import { el } from './dom'

export function showTitleCard(mission: Mission, onBegin: () => void): void {
  const act = actOf(mission.id)
  const begin = el('button', { type: 'button', className: 'card-go', textContent: 'Begin' })
  const words = mission.title.split(' ')
  const middle = Math.ceil(words.length / 2)
  const figure = el('div', { className: 'card-figure' })
  const role = mission.hats[0]
  if (role) figure.innerHTML = crewSilhouette(role)
  const card = el(
    'section',
    { className: 'title-card episodes', ariaLabel: `Episode ${mission.id}: ${mission.title}` },
    el('div', { className: 'card-bar' }),
    el('p', { className: 'card-ep' }, 'Episode', el('b', { textContent: mission.id })),
    figure,
    el(
      'h1',
      { className: 'card-title' },
      el('span', { textContent: words.slice(0, middle).join(' ') }),
      words.length > 1
        ? el('span', { className: 'card-title-2', textContent: words.slice(middle).join(' ') })
        : '',
    ),
    el('p', {
      className: 'card-line',
      textContent: act ? `${act.title}. ${act.line}` : mission.briefing,
    }),
    begin,
  )
  card.dataset.field = episodeField(mission.id)
  begin.addEventListener('click', () => {
    card.remove()
    onBegin()
  })
  document.body.append(card)
  begin.focus()
}
