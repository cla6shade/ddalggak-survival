import { RoomAction } from '../RoomAction'
import type { Session } from '@/core/Session'

/**
 * 체력을 돈으로 바꿉니다. 시급 6,000원 — 최저임금 아래입니다.
 * 초반에는 이게 유일한 현금줄이고, 앱이 자리를 잡으면 그때부터는 손해입니다.
 */
export class PartTimeJob extends RoomAction {
  constructor(session: Session) {
    super(session, 'ACTION-DOOR-001', '외출', '알바하기', 360, -26, 36_000)
  }
}
