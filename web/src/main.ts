import { session } from '@/core/Session'

const root = document.querySelector('#world')
if (!(root instanceof HTMLElement)) throw new Error('#world 를 찾지 못했습니다')

const canvas = document.createElement('canvas')
root.append(canvas)

await session.assets.load()
session.start(canvas)
