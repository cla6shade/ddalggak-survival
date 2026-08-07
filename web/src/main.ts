import { session } from '@/core/Session'

const root = document.querySelector('#world')
if (!(root instanceof HTMLElement)) throw new Error('#world 를 찾지 못했습니다')

const canvas = document.createElement('canvas')
root.append(canvas)

await session.assets.load()
session.start(canvas)

// 엔딩 화면을 기다리지 않고 검수하기 위한 개발 서버 전용 입구입니다.
// 프로덕션 빌드에서는 이 블록 자체가 비활성화됩니다.
if (import.meta.env.DEV) {
  const preview = new URLSearchParams(window.location.search).get('ending')
  if (preview === 'bankrupt') session.updatePlayer({ money: 0 })
  if (preview === 'burnout') session.updatePlayer({ stamina: 0 })
}
