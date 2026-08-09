import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Session } from '@/core/Session'

const INITIAL_CODES = new Set(['ISSUE-DEV-001', 'ISSUE-MRK-001', 'ISSUE-PRD-001'])

test('첫 이슈는 초기 후보 3개 중 하나만 열린다', () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const session = new Session(seed)
    const initial = session.issues.spawnInitialIssue()

    assert.equal(INITIAL_CODES.has(initial.code), true)
    assert.equal(session.issues.count, 1)
  }
})

test('선택지를 시도하면 성공·실패와 무관하게 다른 이슈 하나가 열린다', () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const session = new Session(seed)
    const attempted = session.issues.spawnInitialIssue()
    const option = attempted.options[0]
    assert.ok(option)

    const outcome = session.resolveChoice(attempted, option)
    assert.ok(outcome)
    assert.equal(outcome.spawnedNew, true)

    const newlyOpened = session.issues.openIssues.filter((issue) => issue.code !== attempted.code)
    assert.equal(newlyOpened.length, 1)
    assert.equal(session.issues.count, outcome.solved ? 1 : 2)
  }
})

test('시간만 흘러서는 새로운 일반 이슈가 열리지 않는다', () => {
  const session = new Session(1)
  const initial = session.issues.spawnInitialIssue()

  session.tick(10 * 24 * 60)

  assert.deepEqual(session.issues.openIssues.map((issue) => issue.code), [initial.code])
})
