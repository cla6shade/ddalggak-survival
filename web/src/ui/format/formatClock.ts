/** 자정부터의 분을 시:분으로. 24시를 넘어가도 그날 안의 시각으로 접습니다. */
export function formatClock(minutes: number): string {
  const total = ((Math.floor(minutes) % 1440) + 1440) % 1440
  const hour = Math.floor(total / 60)

  return `${String(hour).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
