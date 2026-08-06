import { Issue } from '../Issue'
import { createDdalggakOption, createDirectOption, createGambleOption } from '../IssueOption'
import { createNeglectEffect } from '../NeglectEffect'
import type { ResolveContext } from '../Issue'
import type { NeglectPressure } from '../NeglectEffect'

/** 사고가 터질 시간당 확률과 그때 나가는 돈. */
const INCIDENT_CHANCE_PER_HOUR = 0.0015
const INCIDENT_COST = 500_000

export class ExposedDatabase extends Issue {
  constructor() {
    super(
      'ISSUE-DEV-005',
      'DEV',
      '데이터베이스 접근 권한이 공개되어 있습니다',
      false,
      createNeglectEffect({ userDeltaPerHour: -0.5, qualityDeltaPerHour: -0.12 }),
      [
        createDirectOption('데이터베이스의 공개 접근을 모두 차단한다', 0.25, 9),
        createDirectOption('테이블별 권한을 하나씩 확인한다', 0.6, 42),
        createDirectOption('보안 경험이 있는 개발자에게 검토를 맡긴다', 0.7, 9, 30_000, 0.05),
        createDdalggakOption(0.45, 0.55),
        createGambleOption('설정 화면의 스위치를 아무거나 눌러본다'),
      ],
    )
  }

  /** 기본 압력에 더해, 흐른 시간만큼 사고를 굴립니다. */
  override onNeglect(minutes: number, pressure: NeglectPressure, context: ResolveContext): void {
    super.onNeglect(minutes, pressure, context)
    // 흐른 시간이 없으면 굴리지 않습니다 — 난수만 한 칸 먹어서 같은 시드의 수열이 어긋납니다.
    if (minutes <= 0) return

    const hours = minutes / 60
    // 시간당 확률을 흐른 시간으로 늘립니다. 짧은 틱을 여러 번 도는 것과 결과가 같아야 합니다.
    if (context.rng.rollChance(1 - (1 - INCIDENT_CHANCE_PER_HOUR) ** hours)) {
      context.player.money -= INCIDENT_COST
      console.log(`[issue] 데이터 유출 사고 — ${INCIDENT_COST.toLocaleString('ko-KR')}원`)
    }
  }

  override getNeglectText(): string {
    const percent = (INCIDENT_CHANCE_PER_HOUR * 100).toFixed(2)

    return `${super.getNeglectText()} · 시간당 ${percent}% 로 ${INCIDENT_COST.toLocaleString('ko-KR')}원 사고`
  }
}
