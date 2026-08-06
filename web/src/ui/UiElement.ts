/**
 * DOM 요소 하나를 감싸는 UI 조각. 자기 요소를 만들고, 자식을 붙이고, 어딘가에 답니다.
 * 무엇을 보여줄지는 상속받는 쪽이 정합니다.
 */
export abstract class UiElement<K extends keyof HTMLElementTagNameMap = 'div'> {
  readonly element: HTMLElementTagNameMap[K]

  constructor(tag: K, className: string) {
    this.element = document.createElement(tag)
    this.element.className = className
  }

  append(...children: UiElement<keyof HTMLElementTagNameMap>[]): void {
    for (const child of children) this.element.append(child.element)
  }

  mountTo(parent: HTMLElement): void {
    parent.append(this.element)
  }

  /** 상태에 따라 붙였다 뗐다 하는 수식 클래스. */
  protected toggleClass(name: string, on: boolean): void {
    this.element.classList.toggle(name, on)
  }
}
