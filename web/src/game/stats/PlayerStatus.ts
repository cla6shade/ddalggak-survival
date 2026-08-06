/** 체력의 상한. 상한이 있는 자원은 이것뿐이라 게이지를 붙일 수 있습니다. */
export const MAX_STAMINA = 100

/**
 * 플레이어가 가진 자원. 필드 초기값이 곧 한 판의 시작 상태입니다.
 * 셋 다 음수로 내려갈 수 있고, 아무 곳에서도 막지 않습니다.
 */
export class PlayerStatus {
  money = 300_000
  stamina = MAX_STAMINA
  credit = 30
}
