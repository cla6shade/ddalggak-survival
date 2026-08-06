import { UiElement } from '../UiElement'
import { HudIcon } from '../primitives/HudIcon'
import type { IconSheet } from '@/assets/IconSheet'
import type { AtlasFrame } from '@/generated/atlas'

/** 동그란 아이콘 하나와 그 아래 이름, 그리고 개수 배지를 가진 버튼. */
export class HudTool extends UiElement<'button'> {
  private readonly circle = document.createElement('span')
  private readonly caption = document.createElement('span')
  private readonly badge = document.createElement('span')

  constructor(icons: IconSheet, frame: AtlasFrame, label: string, onClick: () => void) {
    super('button', 'tool')
    this.element.type = 'button'

    this.circle.className = 'tool__circle'
    this.circle.append(new HudIcon(icons, frame, 'icon tool__icon').element)

    this.badge.className = 'tool__badge'
    this.badge.hidden = true
    this.circle.append(this.badge)

    this.caption.className = 'tool__caption'
    this.caption.textContent = label

    this.element.append(this.circle, this.caption)
    this.element.addEventListener('click', onClick)
  }

  /** 눌러도 볼 게 없을 때는 흐리게 하고 잠급니다. */
  setEnabled(enabled: boolean): void {
    this.element.disabled = !enabled
  }

  /** 배지에 쓸 개수. `0` 이면 배지를 감추고 경고 수식 클래스도 뗍니다. */
  setCount(count: number): void {
    this.badge.hidden = count === 0
    const text = String(count)
    if (this.badge.textContent !== text) this.badge.textContent = text
    this.toggleClass('tool--alert', count > 0)
  }

  /** 한 번 튕기는 애니메이션을 다시 재생합니다. */
  ping(): void {
    this.toggleClass('tool--ping', false)
    // 클래스를 떼자마자 다시 붙이면 브라우저가 같은 프레임으로 묶어서 애니메이션이 안 돕니다.
    void this.circle.offsetWidth
    this.toggleClass('tool--ping', true)
  }
}
