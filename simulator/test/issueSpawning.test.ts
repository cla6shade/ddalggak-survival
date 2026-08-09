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

test('성공하면 다른 이슈가 하나 열리고 실패하면 추가되지 않는다', () => {
  let sawSuccess = false
  let sawFailure = false

  for (let seed = 1; seed <= 100; seed += 1) {
    const session = new Session(seed)
    const attempted = session.issues.spawnInitialIssue()
    const option = attempted.options[0]
    assert.ok(option)

    const outcome = session.resolveChoice(attempted, option)
    assert.ok(outcome)

    const newlyOpened = session.issues.openIssues.filter((issue) => issue.code !== attempted.code)
    if (outcome.solved) {
      sawSuccess = true
      assert.equal(outcome.spawnedNew, true)
      assert.equal(newlyOpened.length, 1)
      assert.equal(session.issues.count, 1)
    } else {
      sawFailure = true
      assert.equal(outcome.spawnedNew, false)
      assert.equal(newlyOpened.length, 0)
      assert.equal(session.issues.count, 1)
    }
  }

  assert.equal(sawSuccess, true)
  assert.equal(sawFailure, true)
})

test('시간만 흘러서는 새로운 일반 이슈가 열리지 않는다', () => {
  const session = new Session(1)
  const initial = session.issues.spawnInitialIssue()

  session.tick(10 * 24 * 60)

  assert.deepEqual(session.issues.openIssues.map((issue) => issue.code), [initial.code])
})
