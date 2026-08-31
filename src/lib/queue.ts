// Pure play-order helpers. No React, no DOM — see queue.test.ts.
//
// The queue is the list of tracks in the order they were added. `order` is a
// permutation of queue indices describing the order they are actually played
// in: identity when shuffle is off, a full shuffled lap when it is on. Keeping
// a whole permutation (rather than picking a random index each time) is what
// makes shuffle play every song once before repeating any of them.

export function identityOrder(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i)
}

function shuffled(items: number[]): number[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

// A lap that starts on `first` — used when shuffle is switched on, or when a
// shuffled queue starts from a song the user tapped.
export function shuffledOrder(n: number, first: number): number[] {
  if (n === 0) return []
  return [first, ...shuffled(identityOrder(n).filter(i => i !== first))]
}

// A fresh lap for repeat-all. Avoids opening on the song that just finished so
// a lap boundary never plays the same track twice in a row.
export function reshuffleOrder(n: number, avoidFirst: number): number[] {
  const order = shuffled(identityOrder(n))
  if (n > 1 && order[0] === avoidFirst) {
    const j = 1 + Math.floor(Math.random() * (n - 1))
    const tmp = order[0]
    order[0] = order[j]
    order[j] = tmp
  }
  return order
}

// Where old queue index `index` ends up after moving `from` to `to`.
export function remapReorder(index: number, from: number, to: number): number {
  if (index === from) return to
  if (from < to) return index > from && index <= to ? index - 1 : index
  if (from > to) return index >= to && index < from ? index + 1 : index
  return index
}

// Queue index `at` was just inserted; slot it into the play order at `orderAt`.
export function orderAfterInsert(order: number[], at: number, orderAt: number): number[] {
  const next = order.map(i => (i >= at ? i + 1 : i))
  next.splice(orderAt, 0, at)
  return next
}

// Queue index `at` was just removed.
export function orderAfterRemove(order: number[], at: number): number[] {
  return order.filter(i => i !== at).map(i => (i > at ? i - 1 : i))
}

// The next position in the play order, or null when playback should stop.
// Returns a new order when repeat-all wraps a shuffled queue into a fresh lap.
export function advanceOrder(
  order: number[],
  orderPos: number,
  shuffle: boolean,
  repeatAll: boolean
): { order: number[]; orderPos: number } | null {
  if (order.length === 0) return null
  if (orderPos + 1 < order.length) return { order, orderPos: orderPos + 1 }
  if (!repeatAll) return null
  return {
    order: shuffle ? reshuffleOrder(order.length, order[orderPos]) : order,
    orderPos: 0,
  }
}
