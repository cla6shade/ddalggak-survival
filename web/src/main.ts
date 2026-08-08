import { session } from '@/core/Session'
import { IntroScreen } from '@/ui/screens/IntroScreen'
import type { EndingId } from '@/game/endings/Ending'

const root = document.querySelector('#world')
if (!(root instanceof HTMLElement)) throw new Error('#world 를 찾지 못했습니다')

const interfaceRoot = document.querySelector('#interface')
if (!(interfaceRoot instanceof HTMLElement)) throw new Error('#interface 를 찾지 못했습니다')

const canvas = document.createElement('canvas')
root.append(canvas)

await session.assets.load()

function begin(): void {
  session.start(canvas)

  // 엔딩 화면을 기다리지 않고 검수하기 위한 개발 서버 전용 입구입니다.
  // 프로덕션 빌드에서는 이 블록 자체가 비활성화됩니다.
  if (import.meta.env.DEV) {
    const preview = new URLSearchParams(window.location.search).get('ending')
    if (preview) session.triggerEnding(preview as EndingId)
  }
}

// 이어서 하는 판은 인트로 없이 곧장 방으로 돌아갑니다.
if (session.hasSavepoint) begin()
else new IntroScreen(session.icons, begin).mountTo(interfaceRoot)
