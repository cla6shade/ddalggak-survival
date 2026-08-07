import { RoomAction } from '../RoomAction'
import { getSleepRecovery } from '../../calc/sleepRecovery'
import type { ActionContext } from '../RoomAction'

/**
 * 체력이 크게 돌아오는 유일한 통로입니다. 자동으로 도는 회복은 없습니다.
 *
 * 회복량이 고정이 아니라서 생성자에는 0 을 넘기고 `getStaminaGain` 을 덮어씁니다 —
 * 열린 이슈가 많을수록 잠을 설칩니다.
 */
export class Sleep extends RoomAction {
  constructor() {
    super('ACTION-BED-001', '취침', '자기', 480, 0, 0)
  }

  override getStaminaGain(context: ActionContext): number {
    const pressure = context.issues.applyNeglect(0, context)

    return getSleepRecovery(context.issues.count, pressure.staminaRecoveryPenalty)
  }

  /** 회복량이 그때그때 달라서 숫자를 약속하지 않습니다. 실제 값은 자고 나서 알림에 뜹니다. */
  override getCostText(): string {
    return '8시간 · 이슈가 많을수록 덜 잡니다'
  }
}
