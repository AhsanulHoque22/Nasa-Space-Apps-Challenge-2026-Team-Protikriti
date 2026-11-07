/**
 * Reading windows: panels of facts and charts that do not need the map open over it, like the
 * site report. The side panel keeps one button for each, so it stays thin and the map stays clear.
 */
let current: HTMLDialogElement | null = null

export type PopupOptions = {
  title: string
  subtitle?: string
  body: Node[]
  /** A way back to the window this one was opened from. */
  back?: { label: string; onClick: () => void }
}

/** Opens one window over the map; a second one replaces the first. */
export function openPopup(o: PopupOptions): HTMLDialogElement {
  closePopup()
  const dialog = document.createElement('dialog')
  dialog.className = 'site-dossier info-popup'
  dialog.setAttribute('aria-labelledby', 'popup-title')
  const head = document.createElement('header')
  head.className = 'sd-head'
  const titles = document.createElement('div')
  if (o.back) {
    const back = document.createElement('button')
    back.type = 'button'
    back.className = 'popup-back'
    back.textContent = `← ${o.back.label}`
    back.addEventListener('click', o.back.onClick)
    titles.append(back)
  }
  const h = document.createElement('h2')
  h.className = 'sd-title'
  h.id = 'popup-title'
  h.textContent = o.title
  titles.append(h)
  if (o.subtitle) {
    const p = document.createElement('p')
    p.className = 'sd-where'
    p.textContent = o.subtitle
    titles.append(p)
  }
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'sd-close'
  close.textContent = 'Close'
  close.addEventListener('click', () => dialog.close())
  head.append(titles, close)
  const body = document.createElement('div')
  body.className = 'popup-body'
  body.append(...o.body)
  dialog.append(head, body)
  dialog.addEventListener('close', () => {
    dialog.remove()
    if (current === dialog) current = null
  })
  // A click on the dimmed map outside the window closes it, as Esc does.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close()
  })
  document.body.append(dialog)
  dialog.showModal()
  close.focus()
  current = dialog
  return dialog
}

export function closePopup(): void {
  current?.close()
}

/**
 * Moves a `<details>` reading panel out of the side panel into a window, leaving a button in its
 * place that keeps the panel's group class, so it still shows under the right workbench tab.
 */
export function asPopup(panel: HTMLDetailsElement, group: string, subtitle?: string): () => void {
  const title = panel.querySelector('summary')?.textContent ?? ''
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `panel popup-launch ${group}`
  button.innerHTML = `<span></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-8 8M10 6H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"/></svg>`
  ;(button.firstElementChild as HTMLElement).textContent = title
  button.setAttribute('aria-haspopup', 'dialog')
  panel.replaceWith(button)
  const open = () => {
    panel.open = true // the panels build their content on first open
    openPopup({ title, subtitle, body: [panel] })
  }
  button.addEventListener('click', open)
  return open
}
