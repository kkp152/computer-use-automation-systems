import { Page, Locator } from 'playwright';
import { TargetDescriptor, TargetStrategy } from '../schema/capability.js';

export interface ResolvedTargetResult {
  locator: Locator;
  strategyUsed: string;
  durationMs: number;
}

export class TargetResolutionError extends Error {
  public descriptor: TargetDescriptor;
  public strategiesAttempted: string[];

  constructor(message: string, descriptor: TargetDescriptor, strategiesAttempted: string[]) {
    super(message);
    this.name = 'TargetResolutionError';
    this.descriptor = descriptor;
    this.strategiesAttempted = strategiesAttempted;
  }
}

export class ReplayLocatorResolver {
  /**
   * Resolves a multi-strategy target descriptor into a viable Playwright Locator.
   * Walks through primary -> fallbacks until one matches and is visible.
   */
  public static async resolve(
    page: Page,
    descriptor: TargetDescriptor,
    timeoutMsPerStrategy: number = 2000
  ): Promise<ResolvedTargetResult> {
    const startTime = Date.now();
    const candidateStrategies: TargetStrategy[] = [descriptor.primary, ...descriptor.fallbacks];
    const attempted: string[] = [];

    for (const strategy of candidateStrategies) {
      const label = this.getStrategyLabel(strategy);
      attempted.push(label);

      try {
        const locator = this.strategyToLocator(page, strategy);
        // Quick assertion to check if element is present in DOM and visible
        await locator.waitFor({ state: 'visible', timeout: timeoutMsPerStrategy });
        return {
          locator,
          strategyUsed: label,
          durationMs: Date.now() - startTime
        };
      } catch (err) {
        // Strategy failed to resolve within timeout, continue to next fallback
      }
    }

    throw new TargetResolutionError(
      `Failed to resolve target after trying ${attempted.length} strategies: [${attempted.join(', ')}]. Rationale: ${descriptor.robustness_rationale}`,
      descriptor,
      attempted
    );
  }

  private static strategyToLocator(page: Page, strategy: TargetStrategy): Locator {
    switch (strategy.strategy) {
      case 'accessibility': {
        const opts: Parameters<Page['getByRole']>[1] = {};
        if (strategy.name) {
          opts.name = strategy.name;
        }
        return page.getByRole(strategy.role as any, opts).first();
      }
      case 'text':
        return page.getByText(strategy.text, { exact: strategy.exact ?? false }).first();
      case 'css':
        return page.locator(strategy.selector).first();
      case 'xpath':
        return page.locator(`xpath=${strategy.xpath}`).first();
      case 'coordinate':
        throw new Error('Coordinate targeting does not map to a Locator');
    }
  }

  private static getStrategyLabel(strategy: TargetStrategy): string {
    switch (strategy.strategy) {
      case 'accessibility':
        return `accessibility(role=${strategy.role}, name="${strategy.name || ''}")`;
      case 'text':
        return `text("${strategy.text}")`;
      case 'css':
        return `css("${strategy.selector}")`;
      case 'xpath':
        return `xpath("${strategy.xpath}")`;
      case 'coordinate':
        return `coordinate(${strategy.x}, ${strategy.y})`;
    }
  }
}
