import type { Rng } from '@/game/Rng'
import type { Decision, PlayerView } from './PlayerView'

/**
 * 화면을 보고 다음에 무엇을 누를지 정하는 사람 노릇.
 *
 * `rng` 는 **게임 난수와 별개인 자기 것**을 받습니다. 같은 것을 나눠 쓰면 정책을
 * 바꾸는 순간 게임 쪽 수열이 밀려, 같은 시드로 돌린 두 정책을 비교할 수 없게 됩니다.
 */
export abstract class Policy {
  constructor(protected readonly rng: Rng) {}

  abstract readonly name: string

  /** 기록에 남길 이 정책의 설정값. 없으면 빈 객체입니다. */
  get params(): Record<string, number> {
    return {}
  }

  abstract decide(view: PlayerView): Decision
}
