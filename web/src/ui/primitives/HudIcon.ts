import { UiElement } from '../UiElement'
import type { IconSheet } from '@/assets/IconSheet'
import type { AtlasFrame } from '@/generated/atlas'

/**
 * 픽셀 아이콘 한 장.
 *
 * 크기는 CSS 가 정합니다. 못 꺼낸 프레임이어도 자리는 그대로 차지해야 옆 글자가 안 밀립니다.
 */
export class HudIcon extends UiElement<'img'> {
  constructor(icons: IconSheet, frame: AtlasFrame, className = 'icon') {
    super('img', className)

    const url = icons.getUrl(frame)
    if (url) this.element.src = url

    this.element.alt = ''
    this.element.decoding = 'async'
  }
}
