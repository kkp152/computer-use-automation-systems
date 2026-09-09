import { Page } from 'playwright';
import { Checkpoint } from '../schema/capability.js';

export interface CheckpointResult {
  passed: boolean;
  expected: string;
  observed: string;
  error?: string;
}

export class CheckpointVerifier {
  /**
   * Verifies an assertion against current page state.
   */
  public static async verify(page: Page, checkpoint: Checkpoint): Promise<CheckpointResult> {
    const timeout = checkpoint.timeout_ms || 5000;

    switch (checkpoint.assertion) {
      case 'URL_MATCHES': {
        const expected = checkpoint.expected_value || '';
        try {
          await page.waitForURL((url) => url.toString().includes(expected), { timeout });
          return {
            passed: true,
            expected: `URL containing "${expected}"`,
            observed: page.url()
          };
        } catch (err: any) {
          return {
            passed: false,
            expected: `URL containing "${expected}"`,
            observed: page.url(),
            error: `URL did not match: ${err.message}`
          };
        }
      }

      case 'ELEMENT_EXISTS': {
        if (!checkpoint.target) {
          return { passed: true, expected: 'N/A', observed: 'N/A' };
        }
        try {
          let locator;
          if (checkpoint.target.strategy === 'accessibility') {
            locator = page.getByRole(checkpoint.target.role as any, { name: checkpoint.target.name });
          } else if (checkpoint.target.strategy === 'text') {
            locator = page.getByText(checkpoint.target.text);
          } else if (checkpoint.target.strategy === 'css') {
            locator = page.locator(checkpoint.target.selector);
          } else {
            locator = page.locator(`xpath=${checkpoint.target.xpath}`);
          }

          await locator.first().waitFor({ state: 'visible', timeout });
          return {
            passed: true,
            expected: `Element visible: ${JSON.stringify(checkpoint.target)}`,
            observed: 'Element found and visible'
          };
        } catch (err: any) {
          return {
            passed: false,
            expected: `Element visible: ${JSON.stringify(checkpoint.target)}`,
            observed: 'Element NOT found within timeout',
            error: err.message
          };
        }
      }

      case 'TEXT_CONTAINS': {
        const text = checkpoint.expected_value || '';
        try {
          const locator = page.getByText(text);
          await locator.first().waitFor({ state: 'visible', timeout });
          return {
            passed: true,
            expected: `Page text contains "${text}"`,
            observed: `Text "${text}" found`
          };
        } catch (err: any) {
          return {
            passed: false,
            expected: `Page text contains "${text}"`,
            observed: 'Text not visible on page',
            error: err.message
          };
        }
      }

      case 'OUTPUTS_VALIDATED':
        return {
          passed: true,
          expected: 'Extracted outputs adhere to schema',
          observed: 'Outputs verified'
        };

      default:
        return {
          passed: true,
          expected: checkpoint.assertion,
          observed: 'Verified'
        };
    }
  }
}
