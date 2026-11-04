/**
 * The logo film that opens the site, once per browser session. A small inline script in index.html
 * decides before first paint (it adds the `intro` class), so the home screen never flashes first.
 * It starts muted because browsers refuse to autoplay sound. It must never stand between the visitor
 * and the site, so any failure hands straight over to the home screen.
 */
export const INTRO_SEEN_KEY = 'atlas-intro-seen'

const START_LIMIT_MS = 4000 // a slow connection gets the site, not a dark screen
const FADE_MS = 400 // matches .intro-leaving in theme.css

export function playIntro(): void {
  const intro = document.querySelector<HTMLElement>('#intro')
  if (!intro) return
  const root = document.documentElement
  const video = intro.querySelector('video')
  if (!root.classList.contains('intro') || !video) {
    intro.remove()
    return
  }
  const home = document.querySelector<HTMLElement>('#first-screen')
  if (home) home.inert = true
  try {
    sessionStorage.setItem(INTRO_SEEN_KEY, 'yes')
  } catch {
    // Storage is blocked: the film plays again next load, which costs nothing.
  }

  let left = false
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') leave()
  }
  const leave = () => {
    if (left) return
    left = true
    clearTimeout(startLimit)
    document.removeEventListener('keydown', onKey)
    video.pause()
    if (home) home.inert = false
    intro.classList.add('intro-leaving')
    const gone = () => {
      intro.remove()
      root.classList.remove('intro')
    }
    intro.addEventListener('transitionend', gone, { once: true })
    setTimeout(gone, FADE_MS + 100) // in case the fade never reports back
  }
  const startLimit = setTimeout(leave, START_LIMIT_MS)

  document.addEventListener('keydown', onKey)
  video.addEventListener('playing', () => clearTimeout(startLimit))
  video.addEventListener('ended', leave)
  video.addEventListener('error', leave)
  intro.querySelector('.intro-skip')?.addEventListener('click', leave)
  const sound = intro.querySelector('.intro-sound')
  sound?.addEventListener('click', () => {
    video.muted = !video.muted
    sound.textContent = video.muted ? 'Sound on' : 'Sound off'
  })
  video.play().catch(leave)
}
