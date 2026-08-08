import { Policy } from '../Policy'
import { PlayerView } from '../PlayerView'
import type { Decision } from '../PlayerView'

/**
 * 아무 것도 하지 않고 시간만 흘려보냅니다.
 *
 * 방치했을 때 판이 어디서 어떻게 무너지는지 재는 바닥선입니다.
 * 이 정책이 엔딩에 닿지 못하면 「손을 놓아도 안 끝나는 게임」이라는 뜻입니다.
 */
export class IdlePolicy extends Policy {
  readonly name = 'idle'

  decide(): Decision {
    return PlayerView.WAIT
  }
}
