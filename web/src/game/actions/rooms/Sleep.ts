import { RoomAction } from '../RoomAction'
import { getSleepRecovery } from '../../calc/sleepRecovery'
import type { Session } from '@/core/Session'

/**
 * 체력이 크게 돌아오는 유일한 통로입니다. 자동으로 도는 회복은 없습니다.
 *
 * 회복량이 고정이 아니라서 생성자에는 0 을 넘기고 `getStaminaGain` 을 덮어씁니다 —
 * 잠을 설치게 하는 이슈가 열려 있으면 그만큼 덜 잡니다.
 */
export class Sleep extends RoomAction {
  constructor(session: Session) {
    super(session, 'ACTION-BED-001', '취침', '자기', 480, 0, 0)
  }

  /**
   * `applyNeglect(0)` 은 시간을 흘리지 않고 지금의 압력만 읽어 옵니다 —
   * 이슈들이 `minutes <= 0` 을 가드하므로 난수도 소비하지 않습니다.
   */
  override getStaminaGain(): number {
    return getSleepRecovery(this.session.issues.applyNeglect(0).staminaRecoveryPenalty)
  }
}
