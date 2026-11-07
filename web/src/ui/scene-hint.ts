/** How to handle a 3D scene, as a pill over it. With `fadeOn`, it fades after the first drag there. */
export function sceneHint(text: string, fadeOn?: HTMLElement): HTMLParagraphElement {
  const hint = document.createElement('p')
  hint.className = 'scene-hint'
  hint.textContent = text
  fadeOn?.addEventListener('pointerdown', () => (hint.dataset.done = ''), { once: true })
  return hint
}
