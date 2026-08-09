import { ResourceTile } from './ResourceTile'
import type { IconSheet } from '@/assets/IconSheet'

/**
 * 크레딧은 눌러서 채우는 유일한 자원이라, 카드 하나가 통째로 구매 창을 여는 버튼입니다.
 * 얼마에 몇 개인지는 창이 펴는 몫이라 카드에는 적지 않습니다.
 */
export class CreditTile extends ResourceTile {
  constructor(icons: IconSheet, warnAt: number, onOpenShop: () => void) {
    super(icons, 'credit', 'resource_credit', '크레딧', warnAt)

    this.element.classList.add('resource--pressable')
    this.element.setAttribute('role', 'button')
    this.element.tabIndex = 0
    this.element.setAttribute('aria-label', '크레딧 충전하기')
    this.element.addEventListener('click', onOpenShop)
    // 키보드로도 눌려야 role="button" 이 거짓말이 아닙니다.
    this.element.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      onOpenShop()
    })
  }
}
