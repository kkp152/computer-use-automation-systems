import { z } from 'zod';

/**
 * Strategy for targeting elements on a surface.
 * Prioritizes Accessibility Tree semantics to survive legacy, unstyled, or restyled DOMs.
 */
export const TargetStrategySchema = z.discriminatedUnion('strategy', [
  z.object({
    strategy: z.literal('accessibility'),
    role: z.string().describe('Accessibility role, e.g. "button", "textbox", "link"'),
    name: z.string().optional().describe('Accessible name or text content'),
    description: z.string().optional().describe('Accessible description if present')
  }),
  z.object({
    strategy: z.literal('text'),
    text: z.string().describe('Visible text content on the screen'),
    exact: z.boolean().default(false).optional()
  }),
  z.object({
    strategy: z.literal('css'),
    selector: z.string().describe('Standard CSS selector')
  }),
  z.object({
    strategy: z.literal('xpath'),
    xpath: z.string().describe('XPath expression')
  }),
  z.object({
    strategy: z.literal('coordinate'),
    x: z.number(),
    y: z.number()
  })
]);

export type TargetStrategy = z.infer<typeof TargetStrategySchema>;

/**
 * Multi-strategy locator descriptor with primary target, fallbacks, and robustness reasoning.
 */
export const TargetDescriptorSchema = z.object({
  primary: TargetStrategySchema,
  fallbacks: z.array(TargetStrategySchema).default([]),
  robustness_rationale: z.string().describe('Why this targeting strategy is robust across tenant branding, layout shifts, or DOM differences')
});

export type TargetDescriptor = z.infer<typeof TargetDescriptorSchema>;

/**
 * Permitted action types in computer-use automation.
 */
export const StepActionSchema = z.enum([
  'NAVIGATE',
  'CLICK',
  'TYPE',
  'SELECT',
  'EXTRACT',
  'ASSERT',
  'WAIT'
]);

export type StepAction = z.infer<typeof StepActionSchema>;

/**
 * State verification assertion / checkpoint.
 */
export const CheckpointSchema = z.object({
  assertion: z.enum([
    'ELEMENT_EXISTS',
    'ELEMENT_NOT_EXISTS',
    'TEXT_CONTAINS',
    'URL_MATCHES',
    'OUTPUTS_VALIDATED'
  ]),
  target: TargetStrategySchema.optional(),
  expected_value: z.string().optional(),
  timeout_ms: z.number().default(5000).optional()
});

export type Checkpoint = z.infer<typeof CheckpointSchema>;

/**
 * Single step inside a capability flow.
 */
export const CapabilityStepSchema = z.object({
  step_id: z.string(),
  intent: z.string().describe('Human-readable description of what this step accomplishes'),
  action: StepActionSchema,
  target: TargetDescriptorSchema.optional(),
  value: z.string().optional().describe('Literal value or fallback input'),
  param_binding: z.string().optional().describe('Dynamic parameter template, e.g. {{inputs.member_id}}'),
  extract_key: z.string().optional().describe('Field key in outputs to assign extracted value'),
  checkpoint: CheckpointSchema.optional().describe('Assertion confirming step succeeded'),
  timeout_ms: z.number().default(8000).optional(),
  risk_level: z.enum(['SAFE_READ', 'REVERSIBLE_WRITE', 'IRREVERSIBLE_MUTATION']).default('SAFE_READ')
});

export type CapabilityStep = z.infer<typeof CapabilityStepSchema>;

/**
 * Expected business outcome pattern detector.
 * Differentiates domain results (e.g. "Record not found") from crashes.
 */
export const BusinessOutcomeDetectorSchema = z.object({
  outcome_id: z.string().describe('Unique identifier for this business outcome, e.g. MEMBER_NOT_FOUND'),
  description: z.string().describe('Business meaning of this outcome'),
  detector: z.object({
    strategy: z.enum(['text_contains', 'selector_exists', 'url_contains']),
    target: z.string().optional(),
    text: z.string().optional()
  }),
  outputs_mapping: z.record(z.any()).describe('Key-value outputs to return when this outcome occurs')
});

export type BusinessOutcomeDetector = z.infer<typeof BusinessOutcomeDetectorSchema>;

/**
 * Recoverable transient condition detector and handler (e.g. dismissing maintenance dialogs).
 */
export const RecoverableConditionSchema = z.object({
  condition_id: z.string(),
  description: z.string(),
  detector: TargetStrategySchema,
  handler_action: z.object({
    action: StepActionSchema,
    target: TargetStrategySchema
  })
});

export type RecoverableCondition = z.infer<typeof RecoverableConditionSchema>;

/**
 * Root Capability Artifact Schema (v1.0.0)
 * An agent-invocable, versioned, typed automation contract.
 */
export const CapabilityArtifactSchema = z.object({
  $schema: z.string().default('https://schema.interface.ai/v1/capability.json'),
  capability_id: z.string().describe('Unique hierarchical capability identifier, e.g. core_banking.member.lookup_savings_balance'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/).describe('Semantic version, e.g. 1.0.0'),
  name: z.string(),
  description: z.string(),
  metadata: z.object({
    author: z.string(),
    created_at: z.string(),
    target_app: z.string(),
    surface: z.enum(['web', 'desktop', 'hybrid']).default('web'),
    tenant_agnostic: z.boolean().default(true)
  }),
  inputs_schema: z.object({
    type: z.literal('object'),
    required: z.array(z.string()),
    properties: z.record(z.object({
      type: z.enum(['string', 'number', 'boolean']),
      description: z.string().optional(),
      pattern: z.string().optional(),
      default: z.any().optional()
    }))
  }),
  outputs_schema: z.object({
    type: z.literal('object'),
    required: z.array(z.string()),
    properties: z.record(z.object({
      type: z.enum(['string', 'number', 'boolean']),
      description: z.string().optional(),
      enum: z.array(z.string()).optional()
    }))
  }),
  policy: z.object({
    risk_level: z.enum(['SAFE_READ', 'REVERSIBLE_WRITE', 'IRREVERSIBLE_MUTATION']),
    domain_allowlist: z.array(z.string()),
    allowed_actions: z.array(StepActionSchema),
    sensitive_data_fields: z.array(z.string()).default(['ssn', 'tax_id', 'full_card_number', 'password', 'token'])
  }),
  steps: z.array(CapabilityStepSchema),
  business_outcomes: z.array(BusinessOutcomeDetectorSchema).default([]),
  recoverable_conditions: z.array(RecoverableConditionSchema).default([]),
  verification_checkpoint: CheckpointSchema.optional()
});

export type CapabilityArtifact = z.infer<typeof CapabilityArtifactSchema>;
