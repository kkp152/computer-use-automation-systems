import readline from 'node:readline';
import { InterventionRequest, InterventionResolution, SessionControlLock } from './session-lock.js';
import { ExecutionLogger } from '../evidence/logger.js';

export class OperatorConsole {
  private lock: SessionControlLock;
  private logger: ExecutionLogger;

  constructor(lock: SessionControlLock, logger: ExecutionLogger) {
    this.lock = lock;
    this.logger = logger;
  }

  /**
   * Dispatches an intervention request and prompts the human operator for live session takeover.
   */
  public async promptOperator(
    request: InterventionRequest,
    autoResolveMode?: 'RESUME_STEP' | 'SKIP_STEP_MANUALLY_COMPLETED' | 'ABORT'
  ): Promise<InterventionResolution> {
    this.lock.yieldToOperator(request);

    this.logger.escalate(`=======================================================`);
    this.logger.escalate(`🚨 HUMAN INTERVENTION REQUIRED - SESSION CONTROL CEDED`);
    this.logger.escalate(`Session ID:        ${request.sessionId}`);
    this.logger.escalate(`Capability:        ${request.capabilityId}`);
    this.logger.escalate(`Step Blocked:      ${request.stepId}`);
    this.logger.escalate(`Reason:            ${request.reason}`);
    this.logger.escalate(`Current URL:       ${request.pageUrl}`);
    if (request.screenshotPath) {
      this.logger.escalate(`Failure Snapshot:  ${request.screenshotPath}`);
    }
    this.logger.escalate(`Recommendation:    ${request.recommendedAction}`);
    this.logger.escalate(`=======================================================`);

    // In automated testing / headless non-interactive mode, support programmatic resolution
    if (autoResolveMode) {
      this.logger.info(`[Auto-Operator] Resolving intervention with action: ${autoResolveMode}`);
      return this.lock.handbackToAutomation({
        action: autoResolveMode,
        operatorNotes: 'Automated resolution via operator console test mode',
        resolvedAt: new Date().toISOString()
      });
    }

    // Interactive CLI prompt
    return new Promise<InterventionResolution>((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      console.log('\nOPERATOR OPTIONS:');
      console.log('  [R] Resume automation (Re-attempt current step after fixing UI state)');
      console.log('  [C] Mark step manually completed (Advance to next step)');
      console.log('  [A] Abort execution\n');

      rl.question('Select option [R/C/A] (default: R): ', (answer) => {
        const choice = (answer || 'R').trim().toUpperCase();
        rl.close();

        let action: InterventionResolution['action'] = 'RESUME_STEP';
        if (choice === 'C') {
          action = 'SKIP_STEP_MANUALLY_COMPLETED';
        } else if (choice === 'A') {
          action = 'ABORT';
        }

        const resolution = this.lock.handbackToAutomation({
          action,
          operatorNotes: `Operator selected option: ${choice}`,
          resolvedAt: new Date().toISOString()
        });

        this.logger.info(`Control returned to automation engine: ${action}`);
        resolve(resolution);
      });
    });
  }
}
