import { Savepoint } from './Savepoint'

const STORAGE_KEY = 'ddalggak-survival/last-savepoint'

/**
 * 마지막 세이브포인트를 브라우저에 넣고 빼는 창구.
 *
 * 저장소만 압니다 — 세이브가 무엇으로 이루어졌고 되살려도 되는 모양인지는
 * `Savepoint` 가 판단합니다.
 */
export class ConfigLoader {
  /** 이어서 시작할 판. 없거나 못 믿을 것이면 `null` 입니다. */
  load(): Savepoint | null {
    return this.access((storage) => {
      const point = Savepoint.parse(storage.getItem(STORAGE_KEY))
      if (!point) storage.removeItem(STORAGE_KEY)

      return point
    })
  }

  save(point: Savepoint): void {
    this.access((storage) => storage.setItem(STORAGE_KEY, JSON.stringify(point)))
  }

  clear(): void {
    this.access((storage) => storage.removeItem(STORAGE_KEY))
  }

  /**
   * localStorage 를 만지는 유일한 자리.
   *
   * 프라이빗 모드나 쿠키가 막힌 브라우저에서는 `window.localStorage` 에 **닿기만 해도**
   * 던지고, 쓰기는 용량이 차면 던집니다. 세이브가 안 된다고 판이 멈출 이유는 없으니
   * 여기서 전부 삼키고 `null` 로 답합니다.
   */
  private access<T>(job: (storage: Storage) => T): T | null {
    try {
      return job(window.localStorage)
    } catch {
      return null
    }
  }
}
