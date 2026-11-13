// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reloadIfNewDeploy } from './stale-deploy'

const reload = vi.fn()
const serve = (html: string) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(html)),
  )

beforeEach(() => {
  // Built, not parsed: happy-dom would try to download a parsed script.
  const script = document.createElement('div')
  script.setAttribute('type', 'module')
  script.setAttribute('src', './assets/index-OLD.js')
  vi.spyOn(document, 'querySelector').mockReturnValue(script)
  sessionStorage.clear()
  reload.mockClear()
  vi.stubGlobal('location', { pathname: '/', reload })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('reloadIfNewDeploy', () => {
  it('reloads once when the server names a different app script', async () => {
    serve('<script type="module" src="./assets/index-NEW.js"></script>')
    expect(await reloadIfNewDeploy()).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(await reloadIfNewDeploy()).toBe(false) // still failing after the reload: a real error
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('keeps the page when it is already the current deploy', async () => {
    serve('<script type="module" src="./assets/index-OLD.js"></script>')
    expect(await reloadIfNewDeploy()).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('keeps the page offline', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    )
    expect(await reloadIfNewDeploy()).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})
