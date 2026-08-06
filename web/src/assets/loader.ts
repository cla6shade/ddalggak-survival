/** `public/assets/` 기준 상대 경로를 vite base 가 붙은 절대 경로로 바꿉니다. */
export function resolveAssetURL(path: string): string {
  // BASE_URL 은 끝 슬래시가 있을 수도 없을 수도 있습니다 (`/ddalggak` vs `/`).
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')

  return `${base}/assets/${path}`
}

export function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`이미지를 불러오지 못했습니다: ${path}`))
    image.src = resolveAssetURL(path)
  })
}

export async function loadJSON<T>(path: string): Promise<T> {
  const res = await fetch(resolveAssetURL(path))
  if (!res.ok) throw new Error(`불러오지 못했습니다: ${path} (${res.status})`)
  return (await res.json()) as T
}
