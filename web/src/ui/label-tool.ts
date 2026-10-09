/** Practice labelling: students paint terrain classes on the panorama, then see how well they agree with AI4Mars. */
import { CLASSES, CLASS_COLOURS, NONE } from '../core/ai4mars'
import {
  CELL_PX,
  LABEL_FILE_VERSION,
  type LabelFile,
  cohenKappa,
  downsampleMode,
} from '../core/label-grade'

// Only the terrain band is labelled: sky and the rover's own body are not terrain (same clamp as the labels layer).
const MAX_EL_DEG = 20
const MIN_EL_DEG = -50

type Raster = { pixels: Uint8ClampedArray; width: number; height: number }
type Expert = { cls: Uint8Array; width: number; height: number }

const landisKoch = (k: number) =>
  k < 0
    ? 'worse than chance'
    : k < 0.2
      ? 'slight'
      : k < 0.4
        ? 'fair'
        : k < 0.6
          ? 'moderate'
          : k < 0.8
            ? 'substantial'
            : 'almost perfect'

export function openLabelTool(
  host: HTMLElement,
  opts: { stop: string; panorama: Raster; expert: Expert },
): { close(): void } {
  const exp = downsampleMode(opts.expert.cls, opts.expert.width, opts.expert.height)
  const { cols, rows } = exp
  const row0 = Math.floor((((90 - MAX_EL_DEG) / 180) * opts.expert.height) / CELL_PX)
  const row1 = Math.ceil((((90 - MIN_EL_DEG) / 180) * opts.expert.height) / CELL_PX)
  const bandRows = row1 - row0
  const student = new Uint8Array(cols * rows).fill(NONE)
  let brush = 0
  let reveal = false
  let cursor = { c: 0, r: row0 }

  const tool = document.createElement('section')
  tool.className = 'panel label-tool'
  tool.setAttribute('aria-label', 'Practice terrain labelling')
  tool.innerHTML = `
    <div class="lt-head"><h3>Practice labelling</h3><button type="button" data-act="close">Close</button></div>
    <p class="lt-help">Paint what the ground is made of, then score yourself against the people who labelled
      these Navcam images for NASA's AI4Mars project. Drag to paint, or use the arrow keys and 1 to 4.</p>
    <div class="lt-brush" role="radiogroup" aria-label="Terrain class">${CLASSES.map(
      (n, i) =>
        `<button type="button" role="radio" aria-checked="${i === 0}" data-class="${i}"><i style="background:${CLASS_COLOURS[i]}"></i>${i + 1} ${n}</button>`,
    ).join('')}<button type="button" data-act="erase" aria-pressed="false">Eraser</button></div>
    <canvas class="lt-canvas" tabindex="0" width="${cols * CELL_PX}" height="${bandRows * CELL_PX}"
      aria-label="Panorama to label: ground between 50 degrees below and 20 degrees above the horizon"></canvas>
    <div class="lt-actions">
      <button type="button" data-act="score">Score my labels</button>
      <button type="button" data-act="reveal" aria-pressed="false">Show AI4Mars labels</button>
      <button type="button" data-act="clear">Clear</button>
      <button type="button" data-act="save">Download my labels</button>
    </div>
    <p class="lt-result" role="status" aria-live="polite"></p>`
  host.append(tool)

  const canvas = tool.querySelector('.lt-canvas') as HTMLCanvasElement
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  const result = tool.querySelector('.lt-result') as HTMLElement
  const photo = document.createElement('canvas')
  photo.width = opts.panorama.width
  photo.height = opts.panorama.height
  photo
    .getContext('2d')
    ?.putImageData(
      new ImageData(new Uint8ClampedArray(opts.panorama.pixels), photo.width, photo.height),
      0,
      0,
    )
  const sy = (row0 * CELL_PX * photo.height) / opts.expert.height
  const sh = (bandRows * CELL_PX * photo.height) / opts.expert.height

  const draw = () => {
    ctx.drawImage(photo, 0, sy, photo.width, sh, 0, 0, canvas.width, canvas.height)
    const paint = (cells: Uint8Array, alpha: number) => {
      for (let r = row0; r < row1; r++)
        for (let c = 0; c < cols; c++) {
          const v = cells[r * cols + c] as number
          if (v === NONE) continue
          ctx.globalAlpha = alpha
          ctx.fillStyle = CLASS_COLOURS[v] as string
          ctx.fillRect(c * CELL_PX, (r - row0) * CELL_PX, CELL_PX, CELL_PX)
        }
      ctx.globalAlpha = 1
    }
    paint(reveal ? exp.cls : student, 0.55)
    if (reveal) paint(student, 0.55) // student on top, so differences show
    ctx.lineWidth = 2
    ctx.strokeStyle = '#fff'
    ctx.strokeRect(
      cursor.c * CELL_PX + 1,
      (cursor.r - row0) * CELL_PX + 1,
      CELL_PX - 2,
      CELL_PX - 2,
    )
  }

  const paintCell = (c: number, r: number) => {
    if (c < 0 || c >= cols || r < row0 || r >= row1) return
    student[r * cols + c] = erasing() ? NONE : brush
    cursor = { c, r }
    draw()
  }
  const erasing = () =>
    tool.querySelector('[data-act="erase"]')?.getAttribute('aria-pressed') === 'true'
  const cellAt = (e: PointerEvent) => {
    const b = canvas.getBoundingClientRect()
    return {
      c: Math.floor(((e.clientX - b.left) / b.width) * cols),
      r: row0 + Math.floor(((e.clientY - b.top) / b.height) * bandRows),
    }
  }
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId)
    const { c, r } = cellAt(e)
    paintCell(c, r)
  })
  canvas.addEventListener('pointermove', (e) => {
    if (!(e.buttons & 1)) return
    const { c, r } = cellAt(e)
    paintCell(c, r)
  })
  canvas.addEventListener('keydown', (e) => {
    const move: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }
    const step = move[e.key]
    if (step) {
      e.preventDefault()
      cursor = {
        c: (cursor.c + step[0] + cols) % cols,
        r: Math.min(row1 - 1, Math.max(row0, cursor.r + step[1])),
      }
      draw()
    } else if (e.key >= '1' && e.key <= '4') {
      e.preventDefault()
      setBrush(Number(e.key) - 1)
      paintCell(cursor.c, cursor.r)
    } else if (e.key === ' ') {
      e.preventDefault()
      paintCell(cursor.c, cursor.r)
    } else if (e.key === 'Delete' || e.key === 'Backspace' || e.key === '0') {
      e.preventDefault()
      student[cursor.r * cols + cursor.c] = NONE
      draw()
    }
  })

  const radios = [...tool.querySelectorAll<HTMLButtonElement>('[data-class]')]
  const setBrush = (i: number) => {
    brush = i
    for (const b of radios) b.setAttribute('aria-checked', String(Number(b.dataset.class) === i))
    tool.querySelector('[data-act="erase"]')?.setAttribute('aria-pressed', 'false')
  }
  for (const b of radios) b.addEventListener('click', () => setBrush(Number(b.dataset.class)))
  const click = (act: string, fn: () => void) =>
    tool.querySelector(`[data-act="${act}"]`)?.addEventListener('click', fn)
  click('erase', () => {
    const b = tool.querySelector('[data-act="erase"]') as HTMLElement
    const on = b.getAttribute('aria-pressed') !== 'true'
    b.setAttribute('aria-pressed', String(on))
    for (const r of radios)
      r.setAttribute('aria-checked', String(!on && Number(r.dataset.class) === brush))
  })
  click('clear', () => {
    student.fill(NONE)
    result.textContent = ''
    draw()
  })
  click('reveal', () => {
    reveal = !reveal
    tool.querySelector('[data-act="reveal"]')?.setAttribute('aria-pressed', String(reveal))
    draw()
  })
  click('score', () => {
    const { kappa, agreement, cells } = cohenKappa(student, exp.cls)
    result.textContent = cells
      ? `You agree on ${Math.round(agreement * 100)}% of the ${cells} cells you both labelled. ` +
        `Kappa ${kappa.toFixed(2)}: ${landisKoch(kappa)} agreement beyond chance. ` +
        `AI4Mars labels are people's too, so this measures agreement, not truth.`
      : 'No overlap yet: label cells where AI4Mars has a label (use "Show AI4Mars labels" to see where).'
  })
  click('save', () => {
    const file: LabelFile = {
      version: LABEL_FILE_VERSION,
      stop: opts.stop,
      classes: CLASSES,
      cols,
      rows,
      student: [...student],
      expert: [...exp.cls],
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }))
    a.download = `labels-${opts.stop}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  })
  const close = () => tool.remove()
  click('close', close)
  draw()
  canvas.focus()
  return { close }
}
