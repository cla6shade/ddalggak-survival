import { Issue } from '../Issue'
import { createDdalggakOption, createDirectOption, createGambleOption } from '../IssueOption'
import { createNeglectEffect } from '../NeglectEffect'
import type { Session } from '@/core/Session'

export class TinyText extends Issue {
  constructor(session: Session) {
    super(
      session,
      'ISSUE-PRD-002',
      'PRD',
      '본문 글자가 지나치게 작습니다',
      '주요 화면의 글자 크기가 너무 작아 사용자가 내용을 편하게 읽기 어렵습니다. 특히 모바일 환경에서는 안내 문구와 버튼명이 잘 보이지 않아 서비스 이용을 포기할 수 있습니다.',
      false,
      createNeglectEffect({ userDeltaPerHour: -0.8, qualityDeltaPerHour: -0.2 }),
      [
        createDirectOption('전체 글자 크기를 한꺼번에 키운다', 0.3, 29),
        createDirectOption('주요 화면을 하나씩 확인하며 조정한다', 0.7, 58),
        createDirectOption('UI 디자이너에게 검토를 부탁한다', 0.5, 24, 20_000, 0.12),
        createDdalggakOption(0.8),
        createGambleOption('일단 메모장에 아무거나 쳐본다'),
      ],
    )
  }
}
