import { describe, it, expect } from 'vitest'
import {
  identityOrder,
  shuffledOrder,
  reshuffleOrder,
  remapReorder,
  orderAfterInsert,
  orderAfterRemove,
  advanceOrder,
} from './queue'

const sorted = (a: number[]) => [...a].sort((x, y) => x - y)

describe('shuffledOrder', () => {
  it('is a permutation starting on the requested track', () => {
    for (let trial = 0; trial < 50; trial++) {
      const order = shuffledOrder(8, 3)
      expect(order[0]).toBe(3)
      expect(sorted(order)).toEqual(identityOrder(8))
    }
  })

  it('handles empty and single-track queues', () => {
    expect(shuffledOrder(0, 0)).toEqual([])
    expect(shuffledOrder(1, 0)).toEqual([0])
  })
})

describe('reshuffleOrder', () => {
  it('never opens on the track that just played', () => {
    for (let trial = 0; trial < 200; trial++) {
      const order = reshuffleOrder(5, 2)
      expect(order[0]).not.toBe(2)
      expect(sorted(order)).toEqual(identityOrder(5))
    }
  })

  it('has no choice but to repeat a one-track queue', () => {
    expect(reshuffleOrder(1, 0)).toEqual([0])
  })
})

describe('remapReorder', () => {
  it('matches an actual splice, for every from/to pair', () => {
    const n = 6
    for (let from = 0; from < n; from++) {
      for (let to = 0; to < n; to++) {
        const arr = identityOrder(n)
        const [moved] = arr.splice(from, 1)
        arr.splice(to, 0, moved)
        for (let i = 0; i < n; i++) {
          expect(remapReorder(i, from, to)).toBe(arr.indexOf(i))
        }
      }
    }
  })
})

describe('orderAfterInsert', () => {
  it('shifts existing indices and slots the new one in', () => {
    // queue [a,b,c], playing b (queue index 1), insert at queue index 2
    expect(orderAfterInsert([0, 1, 2], 2, 2)).toEqual([0, 1, 2, 3])
    // inserting at the front pushes everything up
    expect(orderAfterInsert([2, 0, 1], 0, 1)).toEqual([3, 0, 1, 2])
  })

  it('keeps identity order identity when appending', () => {
    expect(orderAfterInsert([0, 1, 2], 3, 3)).toEqual([0, 1, 2, 3])
  })
})

describe('orderAfterRemove', () => {
  it('drops the index and closes the gap', () => {
    expect(orderAfterRemove([0, 1, 2, 3], 1)).toEqual([0, 1, 2])
    expect(orderAfterRemove([3, 1, 0, 2], 1)).toEqual([2, 0, 1])
  })

  it('stays a valid permutation', () => {
    const order = shuffledOrder(10, 4)
    const next = orderAfterRemove(order, 7)
    expect(sorted(next)).toEqual(identityOrder(9))
  })
})

describe('advanceOrder', () => {
  it('walks forward through the lap', () => {
    expect(advanceOrder([2, 0, 1], 0, true, false)).toEqual({ order: [2, 0, 1], orderPos: 1 })
  })

  it('stops at the end when repeat is off', () => {
    expect(advanceOrder([0, 1], 1, false, false)).toBeNull()
  })

  it('wraps to the start when repeat-all is on', () => {
    expect(advanceOrder([0, 1], 1, false, true)).toEqual({ order: [0, 1], orderPos: 0 })
  })

  it('deals a fresh lap when repeat-all wraps a shuffled queue', () => {
    for (let trial = 0; trial < 100; trial++) {
      const order = [3, 1, 0, 2]
      const next = advanceOrder(order, 3, true, true)!
      expect(next.orderPos).toBe(0)
      expect(sorted(next.order)).toEqual(identityOrder(4))
      // the last track of the old lap must not open the new one
      expect(next.order[0]).not.toBe(2)
    }
  })

  it('stops on an empty queue', () => {
    expect(advanceOrder([], 0, false, true)).toBeNull()
  })

  it('visits every track exactly once per shuffled lap', () => {
    let order = shuffledOrder(12, 5)
    const seen = [order[0]]
    let pos = 0
    for (;;) {
      const next = advanceOrder(order, pos, true, false)
      if (!next) break
      order = next.order
      pos = next.orderPos
      seen.push(order[pos])
    }
    expect(sorted(seen)).toEqual(identityOrder(12))
  })
})
