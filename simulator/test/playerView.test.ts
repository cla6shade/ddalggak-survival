import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Session } from '@/core/Session'
import { PlayerView } from '../src/PlayerView'

/** 화면에 없는 값이 정책에게 새지 않는지. 「실제 플레이어처럼」의 전부입니다. */
const HIDDEN_KEYS = [
  'theftChance',
  'spawnChance',
  'failureEndings',
  'qualityGain',
  'quality',
  'revenue',
  'spend',
  'nextSpawnAt',
  'state',
  'session',
  // 화면에는 날짜 배수가 적용된 `successRate` 만 뜹니다. 기준값은 숨은 값입니다.
  'success',
]

function collectKeys(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, found)

    return found
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      found.add(key)
      collectKeys(child, found)
    }
  }

  return found
}

function openedSession(): Session {
  const session = new Session(3)
  session.issues.spawnInitialIssue()
  // 열린 이슈가 여럿인 상태도 함께 봅니다.
  session.issues.spawnRandomIssue()
  session.issues.spawnRandomIssue()

  return session
}

test('숨겨야 할 값이 뷰에 실리지 않는다', () => {
  const view = PlayerView.from(openedSession())
  const keys = collectKeys(view)

  for (const hidden of HIDDEN_KEYS) {
    assert.equal(keys.has(hidden), false, `'${hidden}' 가 뷰에 새어 나왔습니다`)
  }
})

test('보여야 할 값은 실린다', () => {
  const view = PlayerView.from(openedSession())

  assert.ok(view.issues.length >= 1)
  const issue = view.issues[0]
  assert.ok(issue)
  assert.equal(issue.options.length, 5)

  const option = issue.options[0]
  assert.ok(option)
  assert.ok(option.successRate > 0 && option.successRate <= 1)
  assert.ok(option.minutes > 0)
  assert.equal(typeof option.affordable, 'boolean')

  assert.equal(view.menus.length, 3)
  assert.ok(view.decisions.length > 1)
})

test('뷰를 만드는 동안 난수를 굴리지 않는다', () => {
  const session = openedSession()
  const before = session.rng.state

  PlayerView.from(session)
  PlayerView.from(session)

  assert.equal(session.rng.state, before)
})

test('성공률은 화면이 쓰는 값과 같다', () => {
  const session = openedSession()
  const view = PlayerView.from(session)
  const issue = session.issues.openIssues[0]
  const optionView = view.issues[0]?.options[0]
  assert.ok(issue && optionView)

  const option = issue.options[0]
  assert.ok(option)
  assert.equal(optionView.successRate, issue.getSuccessRate(option))
  assert.equal(optionView.affordable, issue.isAffordable(option))
})
