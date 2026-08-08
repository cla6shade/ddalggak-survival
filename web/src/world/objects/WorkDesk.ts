import { WorldObject } from '../base/WorldObject'
import { session } from '@/core/Session'

export class WorkDesk extends WorldObject {
  constructor() {
    super(
      'work_desk',
      52,
      134,
      64,
      52,
      { x: 52, y: 138, facing: 'back' },
      { left: 20, right: 84, top: 116, bottom: 134 },
      { x: 0, y: 0 },
      64,
    )
  }

  override onInteract(): void {
    session.openIssueList()
  }
}
