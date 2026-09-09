export type RiskLevel = 'SAFE_READ' | 'REVERSIBLE_WRITE' | 'IRREVERSIBLE_MUTATION';

export interface ActionRiskAssessment {
  level: RiskLevel;
  requiresConfirmation: boolean;
  reason: string;
}

export class RiskClassifier {
  /**
   * Assesses the risk level of an action based on its intent, action type, and target context.
   */
  public static assess(
    actionType: string,
    intent: string,
    enforceHumanReviewOnMutation: boolean = true
  ): ActionRiskAssessment {
    const lowerIntent = intent.toLowerCase();

    // High-risk irreversible financial mutations
    const irreversibleKeywords = [
      'transfer', 'wire', 'delete', 'close account', 'submit order',
      'withdraw', 'execute trade', 'modify permission', 'grant access'
    ];

    if (
      actionType === 'CLICK' &&
      irreversibleKeywords.some((kw) => lowerIntent.includes(kw))
    ) {
      return {
        level: 'IRREVERSIBLE_MUTATION',
        requiresConfirmation: enforceHumanReviewOnMutation,
        reason: `Action performs irreversible state mutation: "${intent}"`
      };
    }

    // Reversible inputs and navigation
    if (['TYPE', 'SELECT'].includes(actionType)) {
      return {
        level: 'REVERSIBLE_WRITE',
        requiresConfirmation: false,
        reason: 'Form input is reversible prior to final submission.'
      };
    }

    // Read-only inspection
    return {
      level: 'SAFE_READ',
      requiresConfirmation: false,
      reason: 'Read-only inspection or navigation step.'
    };
  }
}
