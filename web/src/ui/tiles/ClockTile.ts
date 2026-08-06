import { UiElement } from '../UiElement'
import { formatClock } from '../format/formatClock'
import type { Clock } from '@/game/Clock'

/** 인덱스 0 이 1일차입니다. */
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

/** 며칠째인지와 지금 몇 시인지. */
export class ClockTile extends UiElement {
  private readonly day = document.createElement('span')
  private readonly time = document.createElement('span')

  constructor() {
    super('div', 'tile tile--clock')
    this.day.className = 'hud__day'
    this.time.className = 'hud__clock'
    this.element.append(this.day, this.time)
  }

  setTime(clock: Clock): void {
    const day = `${clock.day}일차`
    if (this.day.textContent !== day) this.day.textContent = day

    const weekday = WEEKDAYS[(clock.day - 1) % WEEKDAYS.length] ?? ''
    const time = `${weekday} ${formatClock(clock.minutes)}`
    if (this.time.textContent !== time) this.time.textContent = time
  }
}
