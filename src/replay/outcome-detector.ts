import { Page } from 'playwright';
import { BusinessOutcomeDetector, RecoverableCondition } from '../schema/capability.js';
import { ExecutionLogger } from '../evidence/logger.js';

export interface BusinessOutcomeMatch {
  matched: boolean;
  outcome?: BusinessOutcomeDetector;
  resolvedOutputs?: Record<string, any>;
}

export class OutcomeDetector {
  /**
   * Checks whether the current page satisfies any declared Business Outcome.
   * For example: "Record Not Found" alert after searching for a non-existent member.
   */
  public static async detectBusinessOutcome(
    page: Page,
    outcomes: BusinessOutcomeDetector[],
    inputs: Record<string, any>,
    logger: ExecutionLogger
  ): Promise<BusinessOutcomeMatch> {
    for (const outcome of outcomes) {
      const detector = outcome.detector;

      if (detector.strategy === 'text_contains' && detector.text) {
        try {
          const locator = page.getByText(detector.text);
          const count = await locator.count();
          if (count > 0 && (await locator.first().isVisible())) {
            logger.info(`Detected Expected Business Outcome: [${outcome.outcome_id}] - "${outcome.description}"`);

            // Resolve outputs mapping templates
            const resolvedOutputs: Record<string, any> = {};
            for (const [key, val] of Object.entries(outcome.outputs_mapping)) {
              if (typeof val === 'string' && val.includes('{{inputs.')) {
                resolvedOutputs[key] = val.replace(/\{\{inputs\.([a-zA-Z0-9_]+)\}\}/g, (_, p) => inputs[p] || '');
              } else {
                resolvedOutputs[key] = val;
              }
            }

            return {
              matched: true,
              outcome,
              resolvedOutputs
            };
          }
        } catch (err) {
          // Continue
        }
      }
    }

    return { matched: false };
  }

  /**
   * Checks and auto-remediates any recoverable interruptions (like maintenance interstitials).
   */
  public static async handleRecoverableConditions(
    page: Page,
    recoverableConditions: RecoverableCondition[],
    logger: ExecutionLogger
  ): Promise<boolean> {
    let recoveredAny = false;

    for (const cond of recoverableConditions) {
      if (cond.detector.strategy === 'accessibility') {
        try {
          const dialog = page.getByRole(cond.detector.role as any, { name: cond.detector.name });
          if (await dialog.isVisible({ timeout: 400 })) {
            logger.warn(`Recoverable condition detected: "${cond.description}". Executing recovery handler...`);

            const handler = cond.handler_action;
            if (handler.action === 'CLICK' && handler.target.strategy === 'accessibility') {
              const btn = page.getByRole(handler.target.role as any, { name: handler.target.name });
              await btn.click();
              await page.waitForTimeout(500);
              logger.info(`Successfully dismissed recoverable condition: "${cond.condition_id}"`);
              recoveredAny = true;
            }
          }
        } catch (err) {
          // Dialog not present or check timed out
        }
      }
    }

    return recoveredAny;
  }
}
