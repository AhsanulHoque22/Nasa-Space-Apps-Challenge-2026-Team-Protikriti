/** Run `task`, retrying after each delay (ms) on failure; the last error propagates. */
export async function retry<T>(task: () => Promise<T>, delaysMs: readonly number[]): Promise<T> {
  for (const delay of delaysMs) {
    try {
      return await task()
    } catch {
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  return task()
}
