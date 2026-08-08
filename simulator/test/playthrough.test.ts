import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Playthrough } from '../src/Playthrough'
import { SimConfig } from '../src/RunLog'
import { PolicyRegistry } from '../src/policies/PolicyRegistry'
import type { RunLog } from '../src/RunLog'

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

/** 모든 판은 끝나야 합니다. `aborted` 는 시뮬레이터가 멈춘 것이라 실패입니다. */
for (const policy of PolicyRegistry.names) {
  test(`${policy}: 모든 판이 스스로 끝난다`, () => {
    for (const seed of SEEDS) {
      const { outcome } = Playthrough.play(seed, policy, new SimConfig({ maxDays: 40 }))
      assert.notEqual(outcome.reason, 'aborted', `시드 ${seed} 에서 스텝 상한에 닿았습니다`)
    }
  })
}

test('손을 놓으면 반드시 엔딩에 닿는다', () => {
  // 방치했는데 안 끝나는 게임이면 「버티기만 해도 되는 게임」입니다.
  for (const seed of SEEDS) {
    const { outcome } = Playthrough.play(seed, 'idle', new SimConfig({ maxDays: 90 }))
    assert.equal(outcome.reason, 'ending', `시드 ${seed} 의 방치 판이 안 끝났습니다`)
  }
})

test('사건과 표본은 시간순이다', () => {
  const log = Playthrough.play(1, 'survival')

  assertMonotonic(log.events.map((event) => event.t), '사건')
  assertMonotonic(log.samples.t, '표본')
})

test('표본 배열의 길이가 서로 같다', () => {
  const { samples } = Playthrough.play(1, 'survival')
  const lengths = Object.values(samples).map((column) => column.length)

  assert.equal(new Set(lengths).size, 1, `열마다 길이가 다릅니다: ${lengths.join(', ')}`)
  assert.ok(samples.t.length > 2)
})

test('엔딩으로 끝난 판은 마지막 사건이 엔딩이다', () => {
  const log = Playthrough.play(1, 'survival')
  assert.equal(log.outcome.reason, 'ending')

  const last = log.events.at(-1)
  assert.equal(last?.type, 'ending')
  assert.equal(last?.type === 'ending' ? last.endingId : null, log.outcome.endingId)
})

test('해결한 이슈 수가 스냅숏과 맞는다', () => {
  const log: RunLog = Playthrough.play(2, 'survival')

  assert.equal(log.stats.issuesSolved, log.outcome.snapshot.solvedIssues)
})

test('아무 것도 못 누르는 판에서도 기다림이 남는다', () => {
  // 잔고를 0 으로 만들면 방 행동 대부분이 잠깁니다. 그래도 진행은 멈추면 안 됩니다.
  const { outcome } = Playthrough.play(5, 'random', new SimConfig({ maxDays: 10 }))

  assert.notEqual(outcome.reason, 'aborted')
})

function assertMonotonic(values: readonly number[], label: string): void {
  for (let i = 1; i < values.length; i += 1) {
    const previous = values[i - 1] ?? 0
    const current = values[i] ?? 0
    assert.ok(current >= previous, `${label} ${i} 번째가 뒤로 갔습니다: ${previous} → ${current}`)
  }
}
