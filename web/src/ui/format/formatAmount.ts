/**
 * 숫자를 천 단위로 끊어 읽기 좋게.
 *
 * `digits` 는 소수 자릿수입니다. 시간당 값처럼 1 보다 작을 수 있는 수는 반올림해 버리면
 * 0 으로 보여서 멈춘 것처럼 읽힙니다.
 */
export function formatAmount(value: number, digits = 0): string {
  return value.toLocaleString('ko-KR', { maximumFractionDigits: digits })
}
