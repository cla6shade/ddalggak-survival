/**
 * 취침 회복 규칙 — **침대에서 잘 때만** 적용됩니다. 자동으로 도는 회복은 없습니다.
 *
 * 선택지를 눌러 깎이는 쪽은 `Issue.resolve` 가 직접 빼므로 여기 없습니다.
 */
const BASE = 48
const PENALTY_PER_OPEN_ISSUE = 1.5

/** 아무리 못 자도 이 아래로는 안 내려갑니다. 음수라 자고 나서 오히려 깎일 수 있습니다. */
const WORST_CASE = -20

/** 하룻밤 회복량. 미해결 이슈와 방치 페널티만큼 깎입니다. */
export function getSleepRecovery(openIssueCount: number, staminaRecoveryPenalty: number): number {
  return Math.max(WORST_CASE, BASE - PENALTY_PER_OPEN_ISSUE * openIssueCount - staminaRecoveryPenalty)
}
