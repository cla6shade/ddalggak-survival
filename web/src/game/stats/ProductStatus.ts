/** 만들고 있는 앱의 지표. 필드 초기값이 곧 한 판의 시작 상태입니다. */
export class ProductStatus {
  /** 지금 쓰고 있는 사람 수. */
  users = 0
  /** 한 시간에 늘어나는 사람 수(명/시간). 음수일 수 있습니다. */
  userGrowthPerHour = 0
  /** 한 시간에 들어오는 돈(원/시간). */
  revenuePerHour = 0
  /** 한 시간에 나가는 서버비(원/시간). 나가는 돈이지만 양수로 들고 있습니다. */
  serverCostPerHour = 0
  /** 서비스 품질. `calc/quality.ts` 가 `0`~`MAX_QUALITY` 로 자릅니다. */
  quality = 40
  /** 누적 기록. `PlayerStatus.money` 와는 별개입니다. */
  revenue = 0
  spend = 0

  /** 얕은 복제. */
  clone(): ProductStatus {
    const clone = new ProductStatus()
    clone.users = this.users
    clone.userGrowthPerHour = this.userGrowthPerHour
    clone.revenuePerHour = this.revenuePerHour
    clone.serverCostPerHour = this.serverCostPerHour
    clone.quality = this.quality
    clone.revenue = this.revenue
    clone.spend = this.spend

    return clone
  }
}
