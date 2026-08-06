import type { Facing } from '../geometry/facing'

/** 물건을 쓰려고 가서 설 자리와, 서서 바라볼 쪽. */
export interface StandSpot {
  /** 발밑 좌표. 물건이 막는 면 밖이어야 도착할 수 있습니다. */
  x: number
  y: number
  facing: Facing
}
