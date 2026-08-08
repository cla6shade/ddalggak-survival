import { RoomAction } from '../RoomAction'
import type { Session } from '@/core/Session'

/** 시간당 회복이 가장 빠른 대신 유일하게 돈이 드는 회복입니다. */
export class HomeMeal extends RoomAction {
  constructor(session: Session) {
    super(session, 'ACTION-FRIDGE-001', '식사', '밥 차려 먹기', 30, 14, -6_000)
  }
}
