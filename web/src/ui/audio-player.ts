/** Plays a sequence of pitches with Web Audio. Starts only on a user gesture and can be stopped. */

const TONE_S = 0.18 // length of each tone; a route of 40 tones lasts a few seconds
const GAIN = 0.15

export type Playback = { stop: () => void }

export function playTones(frequencies: readonly number[], onEnd: () => void): Playback {
  const context = new AudioContext()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sine'
  gain.gain.value = GAIN
  oscillator.connect(gain).connect(context.destination)
  const now = context.currentTime
  frequencies.forEach((f, i) => oscillator.frequency.setValueAtTime(f, now + i * TONE_S))
  oscillator.start(now)
  const end = now + frequencies.length * TONE_S
  oscillator.stop(end)
  let done = false
  const finish = () => {
    if (done) return
    done = true
    void context.close()
    onEnd()
  }
  oscillator.onended = finish
  return {
    stop() {
      oscillator.stop()
      finish()
    },
  }
}
