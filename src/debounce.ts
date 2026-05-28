export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T & { cancel: () => void } {
  let timer: NodeJS.Timeout | undefined

  const debounced = ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)

    timer = setTimeout(() => {
      timer = undefined
      fn(...args)
    }, delay)
  }) as T & { cancel: () => void }

  debounced.cancel = () => {
    if (timer) clearTimeout(timer)

    timer = undefined
  }

  return debounced
}
