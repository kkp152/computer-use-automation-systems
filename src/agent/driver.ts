import { Page, Locator } from 'playwright';
import { TargetStrategy } from '../schema/capability.js';

export interface InteractiveElement {
  id?: string;
  role: string;
  name: string;
  value?: string;
  selectorCandidate?: string;
}

export class SurfaceDriver {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  public getPage(): Page {
    return this.page;
  }

  /**
   * Captures the Accessibility Tree snapshot of the current surface.
   * This provides a clean, DOM-agnostic view of roles, names, and states.
   */
  public async getAccessibilityTree(): Promise<any> {
    try {
      const snapshot = await this.page.accessibility.snapshot({ interestingOnly: true });
      return snapshot;
    } catch (err: any) {
      return null;
    }
  }

  /**
   * Summarizes the interactive surface into a clean, compact list of controls.
   * Eliminates boilerplate and non-semantic DOM tags.
   */
  public async getInteractiveSummary(): Promise<InteractiveElement[]> {
    return await this.page.evaluate(() => {
      const elements: InteractiveElement[] = [];
      const interactives = document.querySelectorAll(
        'button, a, input, select, textarea, [role="button"], [role="link"], [role="textbox"], [role="dialog"], [role="alert"]'
      );

      interactives.forEach((el) => {
        const htmlEl = el as HTMLElement;
        const rect = htmlEl.getBoundingClientRect();
        // Only include visible elements
        if (rect.width === 0 || rect.height === 0 || window.getComputedStyle(htmlEl).visibility === 'hidden') {
          return;
        }

        const tag = htmlEl.tagName.toLowerCase();
        let role = htmlEl.getAttribute('role') || tag;
        if (tag === 'input') {
          const type = (htmlEl as HTMLInputElement).type || 'text';
          role = type === 'submit' || type === 'button' ? 'button' : 'textbox';
        } else if (tag === 'a') {
          role = 'link';
        }

        const name =
          htmlEl.getAttribute('aria-label') ||
          htmlEl.innerText?.trim().slice(0, 80) ||
          htmlEl.getAttribute('placeholder') ||
          (htmlEl as HTMLInputElement).value ||
          htmlEl.getAttribute('title') ||
          htmlEl.getAttribute('name') ||
          '';

        let selectorCandidate = '';
        if (htmlEl.id) {
          selectorCandidate = `#${htmlEl.id}`;
        } else if (htmlEl.getAttribute('name')) {
          selectorCandidate = `${tag}[name='${htmlEl.getAttribute('name')}']`;
        }

        elements.push({
          id: htmlEl.id || undefined,
          role,
          name: name.replace(/\s+/g, ' ').trim(),
          value: (htmlEl as HTMLInputElement).value || undefined,
          selectorCandidate: selectorCandidate || undefined
        });
      });

      return elements;
    });
  }

  /**
   * Resolves a target strategy to a Playwright Locator with exact role match.
   */
  public resolveTarget(target: TargetStrategy): Locator {
    switch (target.strategy) {
      case 'accessibility': {
        const options: Parameters<Page['getByRole']>[1] = {};
        if (target.name) {
          options.name = target.name;
        }
        return this.page.getByRole(target.role as any, options).first();
      }
      case 'text':
        return this.page.getByText(target.text, { exact: target.exact ?? false }).first();
      case 'css':
        return this.page.locator(target.selector).first();
      case 'xpath':
        return this.page.locator(`xpath=${target.xpath}`).first();
      case 'coordinate':
        throw new Error('Coordinate targeting requires direct mouse click');
    }
  }

  /**
   * Clicks an element with automatic scrolling and stability check.
   */
  public async click(target: TargetStrategy, timeoutMs: number = 5000): Promise<void> {
    if (target.strategy === 'coordinate') {
      await this.page.mouse.click(target.x, target.y);
      return;
    }
    const locator = this.resolveTarget(target);
    await locator.waitFor({ state: 'visible', timeout: timeoutMs });
    await locator.click();
  }

  /**
   * Types text into a control with natural input dispatch.
   */
  public async type(target: TargetStrategy, text: string, timeoutMs: number = 5000): Promise<void> {
    const locator = this.resolveTarget(target);
    await locator.waitFor({ state: 'visible', timeout: timeoutMs });
    await locator.fill(text);
  }

  /**
   * Extracts text content from a target element.
   */
  public async extractText(target: TargetStrategy, timeoutMs: number = 5000): Promise<string> {
    const locator = this.resolveTarget(target);
    await locator.waitFor({ state: 'visible', timeout: timeoutMs });
    return (await locator.innerText()).trim();
  }
}
