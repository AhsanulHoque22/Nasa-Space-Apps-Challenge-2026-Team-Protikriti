/** Mission replay controls: choose a rover, scrub or play through its sols. */
import type { Stop } from '../core/streetview'
import type { Rover } from '../map/raw-images'
import type { Replay } from '../map/replay'

const SOLS_PER_SECOND = 40
const ROVERS: Record<Rover, { name: string; landing: number }> = {
  m20: { name: 'Perseverance', landing: Date.UTC(2021, 1, 18, 20, 55) },
  msl: { name: 'Curiosity', landing: Date.UTC(2012, 7, 6, 5, 17, 57) },
}
const SOL_MS = 88_775_244

export function renderTimelineBar(
  parent: HTMLElement,
  stops: Record<Rover, Stop[]>,
  replay: Replay,
): void {
  const bar = document.createElement('section')
  bar.className = 'panel timeline'
  bar.setAttribute('aria-label', 'Mission replay')
  bar.innerHTML = `
    <div class="tl-row">
      <div class="view-switch" role="group" aria-label="Rover">
        <button type="button" data-rover="m20" aria-pressed="true">Perseverance</button>
        <button type="button" data-rover="msl" aria-pressed="false">Curiosity</button>
      </div>
      <button type="button" class="tl-play" aria-pressed="false">Play</button>
      <label class="tl-follow"><input type="checkbox" /> Follow</label>
      <button type="button" class="tl-close quiet">Hide</button>
    </div>
    <label class="tl-slider"><span class="visually-hidden">Mission sol</span>
      <input type="range" step="1" /></label>
    <p class="tl-label" aria-live="off"></p>`
  parent.append(bar)
  const slider = bar.querySelector('input[type="range"]') as HTMLInputElement
  const label = bar.querySelector('.tl-label') as HTMLElement
  const play = bar.querySelector('.tl-play') as HTMLButtonElement
  const follow = bar.querySelector('.tl-follow input') as HTMLInputElement
  let rover: Rover = 'm20'
  let playing = 0

  const range = () => {
    const list = stops[rover]
    slider.min = String(Math.max(0, (list[0]?.sol ?? 0) - 1))
    slider.max = String(list.at(-1)?.sol ?? 0)
  }
  const render = () => {
    const sol = Number(slider.value)
    const pos = replay.show(rover, sol)
    const date = new Date(ROVERS[rover].landing + sol * SOL_MS).toISOString().slice(0, 10)
    label.textContent = `${ROVERS[rover].name} · Sol ${sol} · ≈ ${date} (Earth) · ${Math.abs(pos.lat).toFixed(4)}° ${pos.lat < 0 ? 'S' : 'N'}, ${pos.lon.toFixed(4)}° E`
    slider.setAttribute('aria-valuetext', `Sol ${sol}`)
  }
  const stop = () => {
    cancelAnimationFrame(playing)
    playing = 0
    play.textContent = 'Play'
    play.setAttribute('aria-pressed', 'false')
  }
  const tick = (last: number) => (now: number) => {
    const next = Math.min(
      Number(slider.max),
      Number(slider.value) + ((now - last) / 1000) * SOLS_PER_SECOND,
    )
    slider.value = String(Math.floor(next))
    render()
    if (next >= Number(slider.max)) stop()
    else playing = requestAnimationFrame(tick(now))
  }

  for (const b of bar.querySelectorAll<HTMLButtonElement>('[data-rover]')) {
    b.addEventListener('click', () => {
      rover = b.dataset.rover as Rover
      for (const o of bar.querySelectorAll('[data-rover]'))
        o.setAttribute('aria-pressed', String(o === b))
      stop()
      range()
      slider.value = slider.max
      render()
    })
  }
  play.addEventListener('click', () => {
    if (playing) return stop()
    if (Number(slider.value) >= Number(slider.max)) slider.value = slider.min
    play.textContent = 'Pause'
    play.setAttribute('aria-pressed', 'true')
    playing = requestAnimationFrame(tick(performance.now()))
  })
  slider.addEventListener('input', () => {
    stop()
    render()
  })
  follow.addEventListener('change', () => replay.follow(follow.checked))
  bar.querySelector('.tl-close')?.addEventListener('click', () => {
    stop()
    replay.hide()
    bar.classList.toggle('collapsed')
  })
  range()
  slider.value = slider.max
  label.textContent = 'Mission replay: pick a rover and press Play, or drag the slider.'
}
