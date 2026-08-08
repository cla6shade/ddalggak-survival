/**
 * `web/src` 는 vite 앱이라 `import.meta.env` 를 씁니다. 여기서는 vite 를 의존성으로
 * 들이지 않으므로 그 자리만 손으로 채웁니다.
 *
 * 런타임에는 Node 에서 `import.meta.env` 가 `undefined` 지만, 이걸 읽는 자리는
 * `assets/loader.ts` 의 `resolveAssetURL` 하나뿐이고 헤드리스에서는 부르지 않습니다.
 */
interface ImportMetaEnv {
  readonly BASE_URL: string
  readonly DEV: boolean
  readonly PROD: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
