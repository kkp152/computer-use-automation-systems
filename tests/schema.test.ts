import test from 'node:test';
import assert from 'node:assert/strict';
import { CapabilityArtifactSchema } from '../src/schema/capability.js';

test('CapabilityArtifactSchema - validates well-formed capability', () => {
  const validArtifact = {
    $schema: 'https://schema.interface.ai/v1/capability.json',
    capability_id: 'core_banking.member.lookup_savings_balance',
    version: '1.0.0',
    name: 'Lookup Member Savings Balance',
    description: 'Retrieves member savings account balance',
    metadata: {
      author: 'test-agent',
      created_at: new Date().toISOString(),
      target_app: 'ApexCore Banking',
      surface: 'web',
      tenant_agnostic: true
    },
    inputs_schema: {
      type: 'object',
      required: ['member_id'],
      properties: {
        member_id: { type: 'string', description: '5 digit ID' }
      }
    },
    outputs_schema: {
      type: 'object',
      required: ['savings_balance'],
      properties: {
        savings_balance: { type: 'number' }
      }
    },
    policy: {
      risk_level: 'SAFE_READ',
      domain_allowlist: ['localhost'],
      allowed_actions: ['NAVIGATE', 'CLICK', 'TYPE', 'EXTRACT']
    },
    steps: [
      {
        step_id: 'step_1',
        intent: 'Click member search',
        action: 'CLICK',
        target: {
          primary: { strategy: 'accessibility', role: 'link', name: 'Member Search' },
          fallbacks: [{ strategy: 'text', text: 'Member Search' }],
          robustness_rationale: 'Accessibility link role is invariant'
        }
      }
    ],
    business_outcomes: [],
    recoverable_conditions: []
  };

  const parsed = CapabilityArtifactSchema.safeParse(validArtifact);
  assert.equal(parsed.success, true);
});

test('CapabilityArtifactSchema - rejects invalid semantic version', () => {
  const invalidArtifact = {
    capability_id: 'core_banking.test',
    version: 'v1-invalid',
    name: 'Test',
    description: 'Test'
  };

  const parsed = CapabilityArtifactSchema.safeParse(invalidArtifact);
  assert.equal(parsed.success, false);
});
