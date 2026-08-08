import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Playthrough } from '../src/Playthrough'
import { SimConfig } from '../src/RunLog'
import { PolicyRegistry } from '../src/policies/PolicyRegistry'

/**
 * 같은 시드·정책·설정이면 판이 완전히 같아야 합니다.
 *
 * 이게 깨지면 나머지 테스트가 전부 의미를 잃습니다 — 골든도, 배치 통계도
 * 「어제와 다른 게임」을 재고 있는 셈이 됩니다.
 */
for (const policy of PolicyRegistry.names) {
  test(`${policy}: 같은 시드로 두 번 돌리면 같은 판`, () => {
    const first = Playthrough.play(11, policy)
    const second = Playthrough.play(11, policy)

    assert.deepEqual(second, first)
  })
}

test('시드가 다르면 판도 다르다', () => {
  const a = Playthrough.play(11, 'survival')
  const b = Playthrough.play(12, 'survival')

  assert.notDeepEqual(b.outcome, a.outcome)
})

test('틱 길이를 바꾸면 설정 지문도 바뀐다', () => {
  const fine = Playthrough.play(11, 'survival', new SimConfig({ tickMinutes: 1 }))
  const coarse = Playthrough.play(11, 'survival', new SimConfig({ tickMinutes: 5 }))

  assert.notEqual(coarse.meta.configHash, fine.meta.configHash)
})

test('정책 난수는 게임 난수와 갈라져 있다', () => {
  // 아무 것도 누르지 않는 정책은 게임 난수만 굴립니다. 그 수열은 정책이 무엇을
  // 굴리든 흔들리지 않아야 합니다 — 흔들리면 정책 비교가 운 비교가 됩니다.
  const idle = Playthrough.play(11, 'idle')
  const again = Playthrough.play(11, 'idle')

  assert.equal(again.stats.finalRngState, idle.stats.finalRngState)
  assert.notEqual(Playthrough.derivePolicySeed(11), 11)
})
