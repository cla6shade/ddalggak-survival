import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Rng } from '@/game/Rng'
import { Playthrough } from '../src/Playthrough'
import { SimConfig } from '../src/RunLog'
import { PolicyRegistry } from '../src/policies/PolicyRegistry'
import { Traits } from '../src/policies/HumanPolicy'
import type { ChoiceEvent, RunLog } from '../src/RunLog'

const SEEDS = [5, 11, 23]

function choices(log: RunLog): ChoiceEvent[] {
  return log.events.filter((event): event is ChoiceEvent => event.type === 'choice')
}

function fingerprint(log: RunLog): string {
  return choices(log)
    .map((event) => `${event.issueCode}:${event.optionTitle}`)
    .join('|')
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

test('갈래마다 같은 판을 다르게 친다', () => {
  // 한 갈래로만 고르던 옛 구조에서는 이 테스트가 성립하지 않았습니다 —
  // 점수 축이 하나뿐이면 성향을 바꿔도 같은 줄을 누릅니다.
  for (const seed of SEEDS) {
    const prints = new Set(
      Traits.ARCHETYPES.map((name) => fingerprint(Playthrough.play(seed, name))),
    )
    assert.ok(prints.size >= 3, `시드 ${seed} 에서 갈래가 ${prints.size}가지로만 갈렸습니다`)
  }
})

test('갈래마다 다른 종류의 줄을 누른다', () => {
  const shares = new Map<string, number>()

  for (const name of Traits.ARCHETYPES) {
    const picked = SEEDS.flatMap((seed) => choices(Playthrough.play(seed, name)))
    const ddalggak = picked.filter((event) => event.optionKind === 'ddalggak').length
    shares.set(name, picked.length === 0 ? 0 : ddalggak / picked.length)
  }

  const clicker = shares.get('clicker') ?? 0
  const grinder = shares.get('grinder') ?? 0
  // 크레딧이 안 아까운 사람과 몸으로 때우는 사람이 같은 비율로 딸깍하면 성향이 안 먹은 것입니다.
  assert.ok(clicker > grinder, `딸깍 비율: clicker ${clicker} vs grinder ${grinder}`)
})

test('신중한 사람은 낮은 확률을 피한다', () => {
  const oddsOf = (name: string) =>
    mean(SEEDS.flatMap((seed) => choices(Playthrough.play(seed, name)).map((e) => e.successRate)))

  const careful = oddsOf('careful')
  const rusher = oddsOf('rusher')

  assert.ok(careful > rusher, `평균 성공률: careful ${careful} vs rusher ${rusher}`)
  assert.ok(careful > 0.5, `careful 이 평균 ${careful} 짜리를 누르고 있습니다`)
})

test('도박 줄은 어쩌다 한 번만 누른다', () => {
  const picked = Traits.ARCHETYPES.flatMap((name) =>
    SEEDS.flatMap((seed) => choices(Playthrough.play(seed, name))),
  )
  const gambles = picked.filter((event) => event.optionKind === 'gamble')

  // 0 이 아닌 이유는 흔들림입니다 — 사람도 가끔 지릅니다. 다만 드물어야 합니다.
  assert.ok(
    gambles.length / picked.length < 0.03,
    `도박 비율이 ${((gambles.length / picked.length) * 100).toFixed(1)}% 입니다`,
  )
})

test('신중한 갈래는 도박을 아예 안 누른다', () => {
  const gambles = SEEDS.flatMap((seed) => choices(Playthrough.play(seed, 'careful'))).filter(
    (event) => event.optionKind === 'gamble',
  )

  assert.equal(gambles.length, 0)
})

test('같은 성향도 판마다 다르게 흐른다', () => {
  // 온도가 높은 갈래는 정책 난수만 갈아도 다른 길로 가야 합니다.
  const run = (policySeed: number) =>
    new Playthrough({
      seed: 5,
      policySeed,
      policy: PolicyRegistry.create('rusher', new Rng(policySeed)),
      config: new SimConfig(),
    }).run()

  const paths = new Set(Array.from({ length: 10 }, (_, index) => fingerprint(run(index + 1))))
  assert.ok(paths.size >= 2, `정책 시드 10개가 모두 같은 ${[...paths][0]} 경로를 골랐습니다`)
})

test('거의 안 흔들리는 갈래는 같은 길로 간다', () => {
  const run = (policySeed: number) =>
    new Playthrough({
      seed: 5,
      policySeed,
      policy: PolicyRegistry.create('careful', new Rng(policySeed)),
      config: new SimConfig(),
    }).run()

  // 온도 0.15 면 점수 차가 큰 자리에서는 늘 같은 것을 고릅니다.
  // 완전히 같기를 요구하진 않되, 앞부분은 겹쳐야 합니다.
  const a = fingerprint(run(1)).slice(0, 60)
  const b = fingerprint(run(2)).slice(0, 60)
  assert.equal(a, b)
})

test('이슈만 보지 않고 눕기·벌이도 저울에 올린다', () => {
  const log = Playthrough.play(11, 'grinder')
  const kinds = log.stats.decisionsByKind

  assert.ok((kinds.issue ?? 0) > 0, '이슈를 한 번도 안 쳤습니다')
  assert.ok((kinds.action ?? 0) > 0, '방 행동을 한 번도 안 했습니다')
})
