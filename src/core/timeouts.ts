import { Context } from '../context'
import { formatWithOptions } from 'util'
import Yallist = require('yallist')

interface Drift<C extends Context> {
  readonly ctx: C
  readonly timeoutsAt: number
}

const MIN_TIMEOUT_DURATION = 5_000 // 5s in ms

export class Timeouts<C extends Context> {
  private readonly list = new Yallist<Drift<C>>()

  add(drift: Drift<C>) {
    const node = new Yallist.Node(drift)
    this.list.pushNode(node)
    this.runTimer()
    return () => {
      if (node.list != null) {
        this.list.removeNode(node)
      }
    }
  }

  handleTimeout = (drift: Drift<C>) => {
    throw new Error(
      formatWithOptions(
        { depth: 2 },
        'Update processing timed out:',
        drift.ctx.update
      )
    )
  }

  private isTimerRunning = false
  private runTimer() {
    const node = this.list.tail // head works too, sets timers more often
    if (node == null || this.isTimerRunning) return
    this.isTimerRunning = true
    const timeLeft = node.value.timeoutsAt - Date.now()
    const ms = Math.max(timeLeft, MIN_TIMEOUT_DURATION)
    setTimeout(() => {
      try {
        while (true) {
          const node = this.list.head
          if (node == null || node.value.timeoutsAt > Date.now()) break
          this.list.removeNode(node)
          this.handleTimeout(node.value)
        }
      } finally {
        this.isTimerRunning = false
        this.runTimer()
      }
    }, ms).unref()
  }
}
