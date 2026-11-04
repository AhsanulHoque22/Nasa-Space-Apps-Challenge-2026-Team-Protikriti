// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import pageHtml from '../../index.html?raw'
import { INTRO_SEEN_KEY, playIntro } from './intro'

function page(wanted: boolean) {
  document.documentElement.classList.toggle('intro', wanted)
  document.body.innerHTML = `
    <section id="intro">
      <video muted></video>
      <button type="button" class="intro-sound">Sound on</button>
      <button type="button" class="intro-skip">Skip</button>
    </section>
    <section id="first-screen"></section>`
  const video = document.querySelector('video') as HTMLVideoElement
  const play = vi.fn(() => Promise.resolve())
  video.play = play
  const home = document.querySelector('#first-screen') as HTMLElement
  return { video, play, home, intro: () => document.querySelector('#intro') }
}

const finishFade = (intro: Element | null) => intro?.dispatchEvent(new Event('transitionend'))

describe('site intro', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('uses the same key as the inline script that decides before first paint', () => {
    expect(pageHtml).toContain(`sessionStorage.getItem('${INTRO_SEEN_KEY}')`)
  })

  it('removes itself without playing when the page decided against it', () => {
    const { play, intro, home } = page(false)
    playIntro()
    expect(play).not.toHaveBeenCalled()
    expect(intro()).toBeNull()
    expect(home.inert).toBe(false)
  })

  it('plays muted, holds the home screen behind it, and counts as seen for this session', () => {
    const { video, play, home } = page(true)
    playIntro()
    expect(play).toHaveBeenCalledOnce()
    expect(video.muted).toBe(true)
    expect(home.inert).toBe(true)
    expect(sessionStorage.getItem(INTRO_SEEN_KEY)).toBe('yes')
  })

  it('hands over to the home screen when the video ends', () => {
    const { video, home, intro } = page(true)
    playIntro()
    video.dispatchEvent(new Event('ended'))
    expect(home.inert).toBe(false)
    expect(intro()?.classList.contains('intro-leaving')).toBe(true)
    finishFade(intro())
    expect(intro()).toBeNull()
    expect(document.documentElement.classList.contains('intro')).toBe(false)
  })

  it('still leaves if the fade never reports back', () => {
    const { video, intro } = page(true)
    playIntro()
    video.dispatchEvent(new Event('ended'))
    vi.runAllTimers()
    expect(intro()).toBeNull()
  })

  it('Skip and Escape both leave at once', () => {
    const first = page(true)
    playIntro()
    ;(document.querySelector('.intro-skip') as HTMLElement).click()
    expect(first.home.inert).toBe(false)

    const second = page(true)
    playIntro()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(second.home.inert).toBe(false)
  })

  it('never traps the visitor: leaves if the video errors, is refused, or never starts', async () => {
    const broken = page(true)
    playIntro()
    broken.video.dispatchEvent(new Event('error'))
    expect(broken.home.inert).toBe(false)

    const refused = page(true)
    refused.play.mockImplementation(() => Promise.reject(new Error('NotAllowedError')))
    playIntro()
    await vi.advanceTimersByTimeAsync(0)
    expect(refused.home.inert).toBe(false)

    const stalled = page(true)
    playIntro()
    vi.advanceTimersByTime(5000)
    expect(stalled.home.inert).toBe(false)
  })

  it('does not give up once the video has started playing', () => {
    const { video, home } = page(true)
    playIntro()
    video.dispatchEvent(new Event('playing'))
    vi.advanceTimersByTime(60_000)
    expect(home.inert).toBe(true)
  })

  it('the sound button turns the sound on and off and says which', () => {
    const { video } = page(true)
    playIntro()
    const sound = document.querySelector('.intro-sound') as HTMLElement
    sound.click()
    expect(video.muted).toBe(false)
    expect(sound.textContent).toBe('Sound off')
    sound.click()
    expect(video.muted).toBe(true)
    expect(sound.textContent).toBe('Sound on')
  })
})
