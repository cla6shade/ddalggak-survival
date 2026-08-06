import { ResourceTile } from './ResourceTile'
import { Gauge } from '../primitives/Gauge'
import type { IconSheet } from '@/assets/IconSheet'

/** 상한이 있는 자원이라 `ResourceTile` 에 게이지를 하나 더 답니다. */
export class StaminaTile extends ResourceTile {
  private readonly gauge = new Gauge()
  private readonly maximum: number

  constructor(icons: IconSheet, maximum: number, warnAt: number) {
    super(icons, 'stamina', 'resource_stamina', '체력', `/ ${maximum}`, warnAt)
    this.maximum = maximum
    this.body.append(this.gauge.element)
  }

  override setValue(value: number): void {
    super.setValue(value)
    this.gauge.setRatio(value / this.maximum)
  }
}
