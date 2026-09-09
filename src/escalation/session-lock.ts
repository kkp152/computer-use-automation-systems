export type ControlHolder = 'AUTOMATION' | 'OPERATOR';

export interface InterventionRequest {
  sessionId: string;
  capabilityId: string;
  stepId: string;
  reason: string;
  pageUrl: string;
  screenshotPath?: string;
  timestamp: string;
  recommendedAction: string;
}

export interface InterventionResolution {
  action: 'RESUME_STEP' | 'SKIP_STEP_MANUALLY_COMPLETED' | 'ABORT';
  operatorNotes?: string;
  resolvedAt: string;
}

export class SessionControlLock {
  private currentHolder: ControlHolder = 'AUTOMATION';
  private activeIntervention: InterventionRequest | null = null;

  public getHolder(): ControlHolder {
    return this.currentHolder;
  }

  public getActiveIntervention(): InterventionRequest | null {
    return this.activeIntervention;
  }

  /**
   * Automation yields control to a human operator.
   */
  public yieldToOperator(request: InterventionRequest): void {
    if (this.currentHolder === 'OPERATOR') {
      throw new Error('Lock already held by OPERATOR');
    }
    this.currentHolder = 'OPERATOR';
    this.activeIntervention = request;
  }

  /**
   * Operator returns control back to the automation engine.
   */
  public handbackToAutomation(resolution: InterventionResolution): InterventionResolution {
    if (this.currentHolder !== 'OPERATOR') {
      throw new Error('Cannot hand back control: OPERATOR does not currently hold the lock');
    }
    this.currentHolder = 'AUTOMATION';
    this.activeIntervention = null;
    return resolution;
  }
}
