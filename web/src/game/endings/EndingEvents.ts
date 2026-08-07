import { MINUTES_PER_DAY } from '../Clock'
import type { EndingId } from './Ending'
import type { ResolveOutcome } from '../issues/Issue'
import type { Issue } from '../issues/Issue'
import type { IssueOption } from '../issues/IssueOption'
import type { Rng } from '../Rng'

/** 선택 한 번에 발생하는 사건 엔딩 확률. */
const CHOICE_EVENT_CHANCE = 0.05
/** 하루를 온전히 보냈을 때 소송이 발생할 확률. */
const LAWSUIT_CHANCE_PER_DAY = 0.01

/**
 * 선택 결과로 바로 이어지는 엔딩을 판정합니다.
 * 아이디어 도난 확률은 Issue.resolve가 이미 굴렸으므로 여기서 다시 굴리지 않습니다.
 */
export function rollChoiceEnding(
  issue: Issue,
  option: IssueOption,
  outcome: ResolveOutcome,
  rng: Rng,
): EndingId | null {
  if (outcome.stolen) return 'idea-stolen'

  if (
    outcome.solved &&
    issue.domain === 'DEV' &&
    option.kind === 'ddalggak' &&
    rng.rollChance(CHOICE_EVENT_CHANCE)
  ) {
    return 'hacked'
  }

  if (
    issue.code === 'ISSUE-OPS-001' &&
    (option.kind === 'direct' || option.kind === 'ddalggak') &&
    rng.rollChance(CHOICE_EVENT_CHANCE)
  ) {
    return 'consumer-report'
  }

  return null
}

/** 흐른 게임 시간만큼 하루 1% 확률을 환산해 소송 엔딩을 판정합니다. */
export function rollsLawsuit(minutes: number, rng: Rng): boolean {
  if (minutes <= 0) return false

  const chance = 1 - (1 - LAWSUIT_CHANCE_PER_DAY) ** (minutes / MINUTES_PER_DAY)
  return rng.rollChance(chance)
}
