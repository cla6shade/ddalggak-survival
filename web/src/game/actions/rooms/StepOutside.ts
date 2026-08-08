import { RoomAction } from '../RoomAction'
import type { Session } from '@/core/Session'

/** 돈은 들지 않지만 효율이 가장 나쁜 회복입니다. 잘 시간이 없을 때 쓰는 임시방편. */
export class StepOutside extends RoomAction {
  constructor(session: Session) {
    super(session, 'ACTION-DOOR-002', '외출', '잠깐 쉬다 오기', 90, 8, 0)
  }
}
