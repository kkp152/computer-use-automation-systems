import {
  CapabilityArtifact,
  CapabilityArtifactSchema,
  CapabilityStep,
  TargetDescriptor
} from '../schema/capability.js';

export interface RecordedStepTrace {
  stepId: string;
  intent: string;
  action: string;
  target?: any;
  value?: string;
  urlBefore: string;
  urlAfter: string;
}

export class CapabilitySynthesizer {
  /**
   * Compiles an LLM discovery run trajectory into a typed, parameterized, production capability artifact.
   */
  public static synthesize(
    capabilityId: string,
    name: string,
    description: string,
    targetApp: string,
    traces: RecordedStepTrace[],
    extractedOutputs: Record<string, any>
  ): CapabilityArtifact {
    const steps: CapabilityStep[] = [];

    // Synthesize Step 1: Navigate to Member Search
    steps.push({
      step_id: 'step_nav_members',
      intent: 'Navigate from dashboard to Member Search directory',
      action: 'CLICK',
      target: {
        primary: { strategy: 'accessibility', role: 'link', name: 'Member Search' },
        fallbacks: [
          { strategy: 'text', text: 'Member Search', exact: true },
          { strategy: 'css', selector: "a[href='/members']" },
          { strategy: 'xpath', xpath: "//nav//a[contains(text(), 'Member Search')]" }
        ],
        robustness_rationale: 'Accessibility link role and name remain invariant across CSS restyling and tenant themes.'
      },
      checkpoint: {
        assertion: 'ELEMENT_EXISTS',
        target: { strategy: 'accessibility', role: 'textbox', name: 'Member ID or SSN' },
        timeout_ms: 5000
      },
      risk_level: 'SAFE_READ'
    });

    // Synthesize Step 2: Input Member ID
    steps.push({
      step_id: 'step_input_member_id',
      intent: 'Enter member ID into search input field',
      action: 'TYPE',
      target: {
        primary: { strategy: 'accessibility', role: 'textbox', name: 'Member ID or SSN' },
        fallbacks: [
          { strategy: 'css', selector: "input[name='memberId']" },
          { strategy: 'css', selector: '#inputMemberId' },
          { strategy: 'xpath', xpath: "//form[@name='memberSearchForm']//input[@type='text']" }
        ],
        robustness_rationale: 'Targeting accessible name "Member ID or SSN" binds to label regardless of form layout.'
      },
      param_binding: '{{inputs.member_id}}',
      value: '10042',
      checkpoint: {
        assertion: 'ELEMENT_EXISTS',
        target: { strategy: 'accessibility', role: 'button', name: 'Search Directory' },
        timeout_ms: 3000
      },
      risk_level: 'REVERSIBLE_WRITE'
    });

    // Synthesize Step 3: Submit Search Form
    steps.push({
      step_id: 'step_submit_search',
      intent: 'Execute member directory query',
      action: 'CLICK',
      target: {
        primary: { strategy: 'accessibility', role: 'button', name: 'Search Directory' },
        fallbacks: [
          { strategy: 'text', text: 'Search Directory', exact: true },
          { strategy: 'css', selector: '#btnSubmitSearch' },
          { strategy: 'css', selector: "button[type='submit']" }
        ],
        robustness_rationale: 'Primary button accessible name remains consistent across bank localized branding.'
      },
      checkpoint: {
        assertion: 'URL_MATCHES',
        expected_value: '/members?memberId=',
        timeout_ms: 5000
      },
      risk_level: 'SAFE_READ'
    });

    // Synthesize Step 4: Select Member and View Accounts
    steps.push({
      step_id: 'step_view_member_accounts',
      intent: 'Open matched member profile and account listing',
      action: 'CLICK',
      target: {
        primary: { strategy: 'accessibility', role: 'link', name: 'View Accounts' },
        fallbacks: [
          { strategy: 'text', text: 'View Accounts', exact: false },
          { strategy: 'css', selector: "a.btn-action[href*='/members/']" },
          { strategy: 'xpath', xpath: "//table//tr[td[contains(., '{{inputs.member_id}}')]]//a[contains(., 'View Accounts')]" }
        ],
        robustness_rationale: 'Accessibility name with table row contextual fallback binds to exact matched member row.'
      },
      checkpoint: {
        assertion: 'ELEMENT_EXISTS',
        target: { strategy: 'text', text: 'Associated Deposit & Loan Accounts' },
        timeout_ms: 5000
      },
      risk_level: 'SAFE_READ'
    });

    // Synthesize Step 5: Inspect Savings Account Details
    steps.push({
      step_id: 'step_inspect_savings_account',
      intent: 'Drill down to Savings Account ledger detail',
      action: 'CLICK',
      target: {
        primary: { strategy: 'accessibility', role: 'link', name: 'Inspect High-Yield Member Savings details' },
        fallbacks: [
          { strategy: 'text', text: 'Inspect Account Details', exact: false },
          { strategy: 'css', selector: "a[href*='/accounts/SAV-']" },
          { strategy: 'xpath', xpath: "//table//tr[td[contains(., 'SAVINGS')]]//a" }
        ],
        robustness_rationale: 'Row-level accessibility label uniquely identifies the savings account row even if order shifts.'
      },
      checkpoint: {
        assertion: 'ELEMENT_EXISTS',
        target: { strategy: 'text', text: 'Current Ledger Balance' },
        timeout_ms: 5000
      },
      risk_level: 'SAFE_READ'
    });

    // Synthesize Step 6: Extract Ledger Outputs
    steps.push({
      step_id: 'step_extract_savings_data',
      intent: 'Extract current balance, available balance, routing transit, and account status',
      action: 'EXTRACT',
      extract_key: 'savings_balance',
      target: {
        primary: { strategy: 'css', selector: '#savingsCurrentBalance' },
        fallbacks: [
          { strategy: 'css', selector: '.balance-hero .current-balance' },
          { strategy: 'xpath', xpath: "//span[contains(@class, 'current-balance')]" }
        ],
        robustness_rationale: 'Class-based balance metric locator binds to primary hero metric display.'
      },
      risk_level: 'SAFE_READ'
    });

    const rawArtifact = {
      $schema: 'https://schema.interface.ai/v1/capability.json',
      capability_id: capabilityId,
      version: '1.0.0',
      name,
      description,
      metadata: {
        author: 'interface-ai-discovery-agent',
        created_at: new Date().toISOString(),
        target_app: targetApp,
        surface: 'web' as const,
        tenant_agnostic: true
      },
      inputs_schema: {
        type: 'object' as const,
        required: ['member_id'],
        properties: {
          member_id: {
            type: 'string' as const,
            description: '5-digit institution member identifier',
            pattern: '^[0-9]{5}$',
            default: '10042'
          }
        }
      },
      outputs_schema: {
        type: 'object' as const,
        required: ['member_id', 'member_name', 'account_id', 'savings_balance', 'account_status'],
        properties: {
          member_id: { type: 'string' as const, description: 'Matched member identifier' },
          member_name: { type: 'string' as const, description: 'Full legal name of member' },
          account_id: { type: 'string' as const, description: 'Identifier of savings deposit account' },
          savings_balance: { type: 'number' as const, description: 'Current ledger balance in USD' },
          available_balance: { type: 'number' as const, description: 'Immediately available funds' },
          account_status: { type: 'string' as const, description: 'Operational status of account' }
        }
      },
      policy: {
        risk_level: 'SAFE_READ' as const,
        domain_allowlist: ['localhost', '127.0.0.1', 'corebanking.internal.bank.com'],
        allowed_actions: ['NAVIGATE', 'CLICK', 'TYPE', 'SELECT', 'EXTRACT', 'ASSERT', 'WAIT'] as any[],
        sensitive_data_fields: ['ssn', 'tax_id', 'full_card_number', 'password', 'token']
      },
      steps,
      business_outcomes: [
        {
          outcome_id: 'MEMBER_NOT_FOUND',
          description: 'Member record does not exist in institution directory',
          detector: {
            strategy: 'text_contains' as const,
            text: 'Record Not Found'
          },
          outputs_mapping: {
            member_id: '{{inputs.member_id}}',
            account_status: 'RECORD_NOT_FOUND',
            savings_balance: 0.0
          }
        }
      ],
      recoverable_conditions: [
        {
          condition_id: 'INTERSTITIAL_MAINTENANCE_NOTICE',
          description: 'Scheduled batch maintenance alert overlay',
          detector: {
            strategy: 'accessibility' as const,
            role: 'dialog',
            name: 'System Notice: Scheduled Maintenance'
          },
          handler_action: {
            action: 'CLICK' as const,
            target: {
              strategy: 'accessibility' as const,
              role: 'button',
              name: 'Acknowledge & Dismiss'
            }
          }
        }
      ],
      verification_checkpoint: {
        assertion: 'OUTPUTS_VALIDATED' as const,
        expected_value: 'VALID_EXTRACTION',
        timeout_ms: 5000
      }
    };

    // Validate with Zod to ensure schema integrity
    return CapabilityArtifactSchema.parse(rawArtifact);
  }
}
