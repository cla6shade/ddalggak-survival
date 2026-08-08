/**
 * 취침 회복 규칙 — **침대에서 잘 때만** 적용됩니다. 자동으로 도는 회복은 없습니다.
 *
 * 선택지를 눌러 깎이는 쪽은 `Issue.resolve` 가 직접 빼므로 여기 없습니다.
 */
const BASE = 48

/** 아무리 못 자도 이 아래로는 안 내려갑니다. 음수라 자고 나서 오히려 깎일 수 있습니다. */
const WORST_CASE = -20

/**
 * 하룻밤 회복량. 열린 이슈의 방치 페널티만큼만 깎입니다.
 *
 * 이슈 **개수** 는 보지 않습니다 — 이슈를 여럿 안은 채로 버티는 판이
 * 회복까지 막히면 손쓸 방법이 사라집니다. 잠을 설치게 하는 것은
 * `NeglectEffect.staminaRecoveryPenalty` 를 든 이슈뿐입니다.
 */
export function getSleepRecovery(staminaRecoveryPenalty: number): number {
  return Math.max(WORST_CASE, BASE - staminaRecoveryPenalty)
}
