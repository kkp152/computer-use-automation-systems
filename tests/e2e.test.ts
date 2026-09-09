import test from 'node:test';
import assert from 'node:assert/strict';
import { createBankingServer } from '../src/target-app/server.js';
import { runDiscoveryAgent } from '../src/agent/agent-loop.js';
import { DeterministicReplayEngine } from '../src/replay/executor.js';

test('End-to-End System Test: Discovery -> Synthesis -> Deterministic Replay', async (t) => {
  const port = 3456;
  const app = createBankingServer({ port, showInterstitial: true });
  await app.start();

  try {
    // 1. Run Discovery Agent
    const discoveryResult = await runDiscoveryAgent({
      goal: 'Look up member 10042 and extract savings balance',
      targetUrl: `http://localhost:${port}`,
      headless: true,
      maxSteps: 8
    });

    assert.equal(discoveryResult.success, true, 'Discovery agent must successfully complete goal');
    assert.ok(discoveryResult.artifact, 'Capability artifact must be generated');

    const artifact = discoveryResult.artifact;
    assert.equal(artifact.capability_id, 'core_banking.member.lookup_savings_balance');
    assert.equal(artifact.steps.length > 0, true);

    // 2. Deterministic Replay - Happy Path (Member 10042)
    const replayEngine = new DeterministicReplayEngine(artifact, {
      baseUrl: `http://localhost:${port}`,
      headless: true
    });

    const happyResult = await replayEngine.execute({ member_id: '10042' });
    assert.equal(happyResult.status, 'SUCCESS', 'Deterministic replay should succeed on valid member');
    assert.equal(happyResult.outputs.member_name, 'Sarah Connor');
    assert.equal(happyResult.outputs.savings_balance, 18450.25);
    assert.equal(happyResult.outputs.account_status, 'ACTIVE');

    // 3. Deterministic Replay - Expected Business Outcome (Member 99999 Not Found)
    const outcomeResult = await replayEngine.execute({ member_id: '99999' });
    assert.equal(outcomeResult.status, 'BUSINESS_OUTCOME', 'Must recognize Record Not Found as business outcome');
    assert.equal(outcomeResult.business_outcome?.outcome_id, 'MEMBER_NOT_FOUND');
    assert.equal(outcomeResult.outputs.account_status, 'RECORD_NOT_FOUND');

  } finally {
    await app.stop();
  }
});
