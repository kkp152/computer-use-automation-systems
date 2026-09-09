import fs from 'node:fs';
import path from 'node:path';
import { createBankingServer } from './target-app/server.js';
import { runDiscoveryAgent } from './agent/agent-loop.js';
import { DeterministicReplayEngine } from './replay/executor.js';
import { CapabilityCatalog } from './catalog/catalog.js';
import { StabilityTester } from './replay/stability.js';
import { CapabilityArtifactSchema } from './schema/capability.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  switch (command) {
    case 'discover': {
      console.log('🔍 Initiating Computer-Use Discovery Mode...');
      const port = 3000;
      const app = createBankingServer({ port, showInterstitial: true });
      await app.start();
      console.log(`🏦 Target ApexCore Banking App started on http://localhost:${port}`);

      const goal = args[1] || 'Look up member 10042 and extract their current savings account balance and status';
      const targetUrl = `http://localhost:${port}`;

      try {
        const result = await runDiscoveryAgent({
          goal,
          targetUrl,
          headless: !args.includes('--headed'),
          maxSteps: 8
        });

        console.log('\n================ DISCOVERY COMPLETED ================');
        console.log(`Result:          ${result.success ? 'SUCCESS' : 'FAILED'}`);
        console.log(`Steps Recorded:  ${result.totalSteps}`);
        console.log(`Duration:        ${result.durationMs} ms`);
        console.log(`Log File:        ${result.evidenceFiles.logFile}`);
        if (result.evidenceFiles.artifactFile) {
          console.log(`Saved Artifact:  ${result.evidenceFiles.artifactFile}`);
        }
        if (result.evidenceFiles.screenshotFile) {
          console.log(`Screenshot:      ${result.evidenceFiles.screenshotFile}`);
        }
        console.log('=====================================================\n');
      } finally {
        await app.stop();
      }
      break;
    }

    case 'replay': {
      const memberIndex = args.indexOf('--member');
      const memberId = memberIndex !== -1 && args[memberIndex + 1] ? args[memberIndex + 1] : '10042';
      const simulateBlocker = args.includes('--simulate-blocker');
      const artifactPath = path.resolve('./evidence/capability_artifact.json');

      if (!fs.existsSync(artifactPath)) {
        console.error(`❌ Capability artifact not found at ${artifactPath}. Please run "npm run discover" first.`);
        process.exit(1);
      }

      const rawArtifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
      const artifact = CapabilityArtifactSchema.parse(rawArtifact);

      const port = 3001;
      const app = createBankingServer({ port, simulateBlocker });
      await app.start();

      console.log(`🏦 Target ApexCore Banking App started on http://localhost:${port}`);
      if (simulateBlocker) {
        console.log(`⚠️  Injected Supervisor Blocker mode active to exercise Human Escalation.`);
      }

      try {
        const engine = new DeterministicReplayEngine(artifact, {
          baseUrl: `http://localhost:${port}`,
          headless: !args.includes('--headed'),
          autoResolveEscalation: simulateBlocker ? 'RESUME_STEP' : undefined
        });

        const result = await engine.execute({ member_id: memberId });

        console.log('\n================ REPLAY SUMMARY ================');
        console.log(`Run ID:         ${result.run_id}`);
        console.log(`Status:         ${result.status}`);
        console.log(`Duration:       ${result.total_duration_ms} ms`);
        console.log(`Inputs:         ${JSON.stringify(result.inputs)}`);
        console.log(`Outputs:        ${JSON.stringify(result.outputs, null, 2)}`);
        if (result.business_outcome) {
          console.log(`Business Outcome: [${result.business_outcome.outcome_id}] ${result.business_outcome.description}`);
        }
        if (result.evidence.screenshot_file) {
          console.log(`Evidence Shot:  ${result.evidence.screenshot_file}`);
        }
        console.log(`Log File:       ${result.evidence.log_file}`);
        console.log('================================================\n');
      } finally {
        await app.stop();
      }
      break;
    }

    case 'catalog': {
      console.log('📚 Agent-Facing Capability Catalog');
      const catalog = new CapabilityCatalog('http://localhost:3000');
      catalog.loadFromDirectory('./evidence');

      const tools = catalog.getToolDefinitions();
      console.log(`\nDiscovered ${tools.length} callable agent capabilities in catalog:`);
      console.log(JSON.stringify(tools, null, 2));

      if (tools.length > 0) {
        console.log('\n🤖 Simulating Agent Invocation: "lookup_member_savings_balance" with { member_id: "10042" }...');
        const port = 3002;
        const app = createBankingServer({ port });
        await app.start();
        try {
          const invokerCatalog = new CapabilityCatalog(`http://localhost:${port}`);
          invokerCatalog.loadFromDirectory('./evidence');
          const result = await invokerCatalog.invoke('core_banking.member.lookup_savings_balance', { member_id: '10042' });
          console.log(`Result Status: ${result.status}`);
          console.log(`Outputs:`, result.outputs);
        } finally {
          await app.stop();
        }
      }
      break;
    }

    case 'stability': {
      const artifactPath = path.resolve('./evidence/capability_artifact.json');
      if (!fs.existsSync(artifactPath)) {
        console.error(`❌ Artifact not found at ${artifactPath}. Run discovery first.`);
        process.exit(1);
      }
      const rawArtifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
      const artifact = CapabilityArtifactSchema.parse(rawArtifact);

      const port = 3003;
      const app = createBankingServer({ port });
      await app.start();
      try {
        await StabilityTester.testStability(
          artifact,
          { member_id: '10042' },
          { baseUrl: `http://localhost:${port}`, headless: true },
          3
        );
      } finally {
        await app.stop();
      }
      break;
    }

    case 'help':
    default:
      console.log(`
Computer-Use Automation System CLI (interface.ai)

Usage:
  npm run discover                   Run LLM discovery agent against ApexCore Banking
  npm run replay                     Deterministically replay capability (Happy Path: member 10042)
  npm run replay:outcome             Replay expecting business outcome (Member 99999 Not Found)
  npm run replay:escalate            Replay with injected blocker exercising Human Escalation
  npm run catalog                    List and invoke capabilities via Agent Function-Calling interface
  npm test                           Run automated unit and integration tests
      `);
      break;
  }
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
