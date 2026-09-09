import { StepAction } from '../schema/capability.js';

export interface PolicyConfig {
  domainAllowlist: string[];
  allowedActions: StepAction[];
  requireConfirmationForIrreversible?: boolean;
}

export class PolicyGuardrail {
  private config: PolicyConfig;

  constructor(config: PolicyConfig) {
    this.config = config;
  }

  /**
   * Validates whether a target navigation URL is permitted.
   */
  public isUrlAllowed(rawUrl: string): { allowed: boolean; reason?: string } {
    try {
      const parsed = new URL(rawUrl);
      const hostname = parsed.hostname;

      const isPermitted = this.config.domainAllowlist.some((domain) => {
        if (domain === hostname) return true;
        if (domain.startsWith('*.')) {
          const root = domain.slice(2);
          return hostname.endsWith(root);
        }
        return false;
      });

      if (!isPermitted) {
        return {
          allowed: false,
          reason: `Domain '${hostname}' is not in policy allowlist [${this.config.domainAllowlist.join(', ')}]`
        };
      }

      return { allowed: true };
    } catch (e: any) {
      return { allowed: false, reason: `Malformed URL: ${rawUrl}` };
    }
  }

  /**
   * Validates whether an action type is allowed.
   */
  public isActionAllowed(action: StepAction): { allowed: boolean; reason?: string } {
    if (!this.config.allowedActions.includes(action)) {
      return {
        allowed: false,
        reason: `Action '${action}' is not in permitted actions [${this.config.allowedActions.join(', ')}]`
      };
    }
    return { allowed: true };
  }
}
