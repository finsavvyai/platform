import '@testing-library/jest-dom'

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R
      toHaveClass(...classNames: string[]): R
      toBeDisabled(): R
      toBeEnabled(): R
      toBeVisible(): R
      toHaveFocus(): R
      toHaveTextContent(text: string | RegExp): R
      toHaveAttribute(attr: string, value?: string | RegExp): R
      toHaveStyle(css: string | Record<string, unknown>): R
      toBeChecked(): R
      toBePartiallyChecked(): R
      toBeEmpty(): R
      toBeEmptyDOMElement(): R
      toBeRequired(): R
      toBeValid(): R
      toBeInvalid(): R
      toContainElement(element: HTMLElement | null): R
      toContainHTML(html: string): R
      toHaveValue(value?: string | string[] | number | null): R
      toHaveDisplayValue(value: string | RegExp | Array<string | RegExp>): R
      toHaveDescription(text?: string | RegExp): R
      toHaveAccessibleDescription(text?: string | RegExp): R
      toHaveAccessibleName(text?: string | RegExp): R
      toHaveErrorMessage(text?: string | RegExp): R
    }
  }
}
