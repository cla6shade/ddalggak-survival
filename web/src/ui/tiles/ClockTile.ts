import { UiElement } from '../UiElement'
import { HudIcon } from '../primitives/HudIcon'
import { formatClock } from '../format/formatClock'
import type { IconSheet } from '@/assets/IconSheet'
import type { Clock } from '@/game/Clock'

/** 며칠째인지와 지금 몇 시인지. */
export class ClockTile extends UiElement {
  private readonly day = document.createElement('span')
  private readonly time = document.createElement('span')

  constructor(icons: IconSheet) {
    super('div', 'tile tile--clock')
    this.day.className = 'hud__day'
    this.time.className = 'hud__clock'

    // 날짜와 시각은 크기가 다릅니다. 한 덩어리로 묶어야 둘이 같은 줄에 실려
    // 밑선을 공유하고, 그 덩어리가 통째로 아이콘과 가운데를 맞춥니다.
    const text = document.createElement('div')
    text.className = 'clock__text'
    text.append(this.day, this.time)

    this.element.append(new HudIcon(icons, 'resource_time', 'icon icon--md').element, text)
  }

  setTime(clock: Clock): void {
    const day = `${clock.day}일차`
    if (this.day.textContent !== day) this.day.textContent = day

    const time = formatClock(clock.minutes)
    if (this.time.textContent !== time) this.time.textContent = time
  }
}
