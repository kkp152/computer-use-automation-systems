import test from 'node:test';
import assert from 'node:assert/strict';
import { PiiRedactor } from '../src/safety/pii-redactor.js';
import { PolicyGuardrail } from '../src/safety/allowlist.js';
import { RiskClassifier } from '../src/safety/risk-classifier.js';

test('PiiRedactor - masks SSN and Card numbers from strings', () => {
  const sensitiveText = 'Customer SSN is 123-45-6789 and Card is 4111-2222-3333-4444 with password supersecret';
  const redacted = PiiRedactor.redactText(sensitiveText);

  assert.equal(redacted.includes('123-45-6789'), false);
  assert.equal(redacted.includes('***-**-6789'), true);
  assert.equal(redacted.includes('4111-2222-3333-4444'), false);
  assert.equal(redacted.includes('****-****-****-4444'), true);
});

test('PiiRedactor - deeply redacts nested objects and sensitive keys', () => {
  const sensitiveObj = {
    user: 'Sarah Connor',
    tax_id: '123-45-6789',
    credentials: {
      password: 'mypassword123',
      apiKey: 'AIzaSyD-dummy-key-999'
    }
  };

  const clean = PiiRedactor.redactObject(sensitiveObj);
  assert.equal(clean.tax_id, '***-**-6789');
  assert.equal(clean.credentials.password, '[REDACTED_SENSITIVE_KEY]');
  assert.equal(clean.credentials.apiKey, '[REDACTED_SENSITIVE_KEY]');
});

test('PolicyGuardrail - permits allowlisted domains and blocks external ones', () => {
  const guardrail = new PolicyGuardrail({
    domainAllowlist: ['localhost', '127.0.0.1', '*.bank.internal'],
    allowedActions: ['NAVIGATE', 'CLICK', 'TYPE']
  });

  assert.equal(guardrail.isUrlAllowed('http://localhost:3000/members').allowed, true);
  assert.equal(guardrail.isUrlAllowed('https://core.bank.internal/dashboard').allowed, true);
  assert.equal(guardrail.isUrlAllowed('https://malicious-site.com/steal').allowed, false);
});

test('RiskClassifier - classifies wire transfers as IRREVERSIBLE_MUTATION', () => {
  const assessment = RiskClassifier.assess('CLICK', 'Confirm and submit international wire transfer of $10,000');
  assert.equal(assessment.level, 'IRREVERSIBLE_MUTATION');
  assert.equal(assessment.requiresConfirmation, true);
});

test('RiskClassifier - classifies search queries as SAFE_READ', () => {
  const assessment = RiskClassifier.assess('CLICK', 'Click search directory button');
  assert.equal(assessment.level, 'SAFE_READ');
  assert.equal(assessment.requiresConfirmation, false);
});
