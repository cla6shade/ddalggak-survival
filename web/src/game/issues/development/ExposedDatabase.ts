import { Issue } from '../Issue'
import { createDdalggakOption, createDirectOption, createGambleOption } from '../IssueOption'
import { createNeglectEffect } from '../NeglectEffect'
import { getChanceOver } from '../../endings/EndingEvents'
import { MINUTES_PER_HOUR } from '../../Clock'
import type { NeglectPressure } from '../NeglectEffect'
import type { Session } from '@/core/Session'

/**
 * 열어 둔 채로 한 시간을 보냈을 때 뚫릴 확률과, 그대로 정보가 새 나갈 확률. 서로 독립입니다.
 *
 * 하루가 아니라 시간 단위입니다 — 권한이 열린 데이터베이스를 하루 내내 두고도
 * 멀쩡할 리가 없습니다. 5% 면 하루를 꼬박 방치했을 때 각각 71%, 둘 중 하나는 92% 입니다.
 */
const HACK_CHANCE_PER_HOUR = 0.05
const LEAK_CHANCE_PER_HOUR = 0.05

export class ExposedDatabase extends Issue {
  constructor(session: Session) {
    super(
      session,
      'ISSUE-DEV-005',
      'DEV',
      '데이터베이스 접근 권한이 공개되어 있습니다',
      false,
      createNeglectEffect({ userDeltaPerHour: -0.5, qualityDeltaPerHour: -0.12 }),
      [
        createDirectOption('데이터베이스의 공개 접근을 모두 차단한다', 0.25, 24),
        createDirectOption('테이블별 권한을 하나씩 확인한다', 0.6, 71),
        createDirectOption('보안 경험이 있는 개발자에게 검토를 맡긴다', 0.7, 15, 30_000, 0.12),
        createDdalggakOption(0.45, 0.55),
        createGambleOption('설정 화면의 스위치를 아무거나 눌러본다'),
      ],
    )
  }

  /**
   * 기본 압력에 더해, 흐른 시간만큼 침입과 유출을 각각 굴립니다.
   *
   * 확률은 화면 어디에도 쓰지 않습니다 — `getNeglectText` 를 덮어쓰지 않는 것이
   * 그 약속입니다. 여기서 걸리면 판이 그대로 끝납니다.
   */
  override onNeglect(minutes: number, pressure: NeglectPressure): void {
    super.onNeglect(minutes, pressure)
    // 흐른 시간이 없으면 굴리지 않습니다 — 난수만 한 칸 먹어서 같은 시드의 수열이 어긋납니다.
    if (minutes <= 0) return

    const { rng } = this.session
    const periods = minutes / MINUTES_PER_HOUR
    if (rng.rollChance(getChanceOver(HACK_CHANCE_PER_HOUR, periods))) {
      return this.session.triggerEnding('hacked')
    }
    if (rng.rollChance(getChanceOver(LEAK_CHANCE_PER_HOUR, periods))) {
      this.session.triggerEnding('data-leak')
    }
  }
}
