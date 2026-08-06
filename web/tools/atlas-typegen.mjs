// public/assets/ 에 놓인 아틀라스를 검사하고, 거기서 키 union 을 뽑아
// src/generated/atlas.ts 를 만듭니다.
//
//     node tools/atlas-types.mjs           다시 만들기
//     node tools/atlas-types.mjs --check   만들어보고 파일과 다르면 실패 (빌드용)
//

import { readFile, readdir, writeFile, mkdir, access } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const web = resolve(here, '..')
const assets = join(web, 'public', 'assets')
const generated = join(web, 'src', 'generated', 'atlas.ts')

// src/config.ts 의 ATLAS_KEY. animations.json 의 프레임 참조가 이 텍스처를
// 가리켜야 Phaser 가 찾습니다. 다른 이름으로 내보내면 애니메이션만 조용히 죽습니다.
const ATLAS_KEY = 'game'

const check = process.argv.includes('--check')
const problems = []

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function pngSize(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature)) return null
  return { w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20) }
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (!(await exists(assets))) {
  fail(`아틀라스가 없습니다: ${assets}\n디자이너에게 받은 atlas.png / atlas.json / animations.json 을 여기에 넣으세요.`)
}

for (const name of ['atlas.png', 'atlas.json', 'animations.json']) {
  if (!(await exists(join(assets, name)))) fail(`필수 파일이 없습니다: ${join(assets, name)}`)
}

const image = pngSize(await readFile(join(assets, 'atlas.png')))
if (!image) fail('atlas.png 를 PNG 로 읽을 수 없습니다.')

let atlas
try {
  atlas = JSON.parse(await readFile(join(assets, 'atlas.json'), 'utf8'))
} catch (error) {
  fail(`atlas.json 을 읽을 수 없습니다: ${error.message}`)
}

const frames = atlas.frames ?? {}
const frameNames = Object.keys(frames).sort()
if (frameNames.length === 0) problems.push('atlas.json 에 프레임이 하나도 없습니다.')

const meta = atlas.meta?.size
if (!meta || meta.w !== image.w || meta.h !== image.h) {
  problems.push(
    `meta.size ${meta ? `${meta.w}x${meta.h}` : '(없음)'} 가 atlas.png 크기 ${image.w}x${image.h} 와 다릅니다.`,
  )
}

for (const name of frameNames) {
  const rect = frames[name]?.frame
  if (!rect) {
    problems.push(`${name}: frame 이 없습니다.`)
    continue
  }
  const { x, y, w, h } = rect
  if (!(w > 0 && h > 0)) {
    problems.push(`${name}: 크기가 ${w}x${h} 입니다.`)
  } else if (x < 0 || y < 0 || x + w > image.w || y + h > image.h) {
    problems.push(`${name}: ${x},${y} ${w}x${h} 가 아틀라스 ${image.w}x${image.h} 밖으로 나갑니다.`)
  }
}

// BootScene 이 무조건 불러오고 Character 가 이름으로 재생하기 때문에,
// animations.json 은 비어 있을 수는 있어도 없을 수는 없습니다.
let anims
try {
  anims = JSON.parse(await readFile(join(assets, 'animations.json'), 'utf8'))
} catch (error) {
  fail(`animations.json 을 읽을 수 없습니다: ${error.message}`)
}

const known = new Set(frameNames)
const seen = new Set()
for (const anim of anims.anims ?? []) {
  if (!anim.key) {
    problems.push('animations.json: key 없는 애니메이션이 있습니다.')
    continue
  }
  if (seen.has(anim.key)) problems.push(`animations.json: "${anim.key}" 가 중복입니다.`)
  seen.add(anim.key)

  for (const frame of anim.frames ?? []) {
    if (frame.key !== ATLAS_KEY) {
      problems.push(`${anim.key}: 텍스처가 "${frame.key}" 입니다. "${ATLAS_KEY}" 여야 합니다.`)
    }
    if (!known.has(frame.frame)) {
      problems.push(`${anim.key}: atlas.json 에 없는 프레임 "${frame.frame}" 을 가리킵니다.`)
    }
  }
}
const animKeys = [...seen].sort()

// 타일은 아틀라스에 안 들어갑니다 — 패킹의 1픽셀 익스트루드가 반복 시 이음매를
// 만들기 때문에. 그래서 폴더의 파일 목록이 곧 타일 목록입니다.
const tilesDir = join(assets, 'tiles')
const tiles = (await exists(tilesDir))
  ? (await readdir(tilesDir))
      .filter((name) => name.endsWith('.png'))
      .map((name) => name.slice(0, -'.png'.length))
      .sort()
  : []

if (problems.length > 0) {
  console.error(`아틀라스에 문제가 ${problems.length}건 있습니다:`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

function union(name, values) {
  if (values.length === 0) return `export type ${name} = never\n`
  return `export type ${name} =\n${values.map((v) => `  | ${JSON.stringify(v)}`).join('\n')};\n`
}

const source =
  '// public/assets/ 의 아틀라스에서 생성됩니다. 고치지 마세요.\n' +
  '// 다시 만들려면: pnpm assets:types\n\n' +
  union('AtlasFrame', frameNames) +
  '\n' +
  union('AnimKey', animKeys) +
  '\n' +
  '/** 타일은 아틀라스 밖 낱장 PNG 라 BootScene 이 이름을 하나씩 불러야 합니다. */\n' +
  `export const TILE_TEXTURES = [\n${tiles.map((t) => `  ${JSON.stringify(t)},`).join('\n')}\n] as const\n\n` +
  'export type TileTexture = (typeof TILE_TEXTURES)[number]\n'

const current = (await exists(generated)) ? await readFile(generated, 'utf8') : null

if (check) {
  if (current !== source) {
    fail('src/generated/atlas.ts 가 public/assets/ 의 아틀라스와 맞지 않습니다.\n`pnpm assets:types` 를 돌리고 결과를 커밋하세요.')
  }
  console.log(`아틀라스 확인 완료 — 프레임 ${frameNames.length}종, 애니메이션 ${animKeys.length}종, 타일 ${tiles.length}종`)
} else {
  if (current === source) {
    console.log('바뀐 것이 없습니다.')
  } else {
    await mkdir(dirname(generated), { recursive: true })
    await writeFile(generated, source)
    console.log(`src/generated/atlas.ts 갱신 — 프레임 ${frameNames.length}종, 애니메이션 ${animKeys.length}종, 타일 ${tiles.length}종`)
  }
}
