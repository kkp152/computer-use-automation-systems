import { CapabilityArtifact } from '../schema/capability.js';
import { DeterministicReplayEngine, ReplayOptions } from './executor.js';

export interface StabilityReport {
  capabilityId: string;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  businessOutcomeRuns: number;
  successRate: number;
  flakinessScore: number;
  averageDurationMs: number;
  durations: number[];
}

export class StabilityTester {
  /**
   * Replays a capability N times and computes reliability, latency, and flakiness metrics.
   */
  public static async testStability(
    artifact: CapabilityArtifact,
    inputs: Record<string, any>,
    options: ReplayOptions,
    iterations: number = 3
  ): Promise<StabilityReport> {
    console.log(`\n🧪 Running Multi-Run Stability Test (${iterations} iterations)...`);
    const durations: number[] = [];
    let successCount = 0;
    let failCount = 0;
    let outcomeCount = 0;

    const engine = new DeterministicReplayEngine(artifact, options);

    for (let i = 1; i <= iterations; i++) {
      console.log(`   --> Iteration ${i}/${iterations}...`);
      const result = await engine.execute(inputs);
      durations.push(result.total_duration_ms);

      if (result.status === 'SUCCESS') {
        successCount++;
      } else if (result.status === 'BUSINESS_OUTCOME') {
        outcomeCount++;
      } else {
        failCount++;
      }
    }

    const avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / iterations);
    const successRate = (successCount / iterations) * 100;
    const flakinessScore = (failCount / iterations);

    console.log(`\n📊 Stability Report for ${artifact.capability_id}:`);
    console.log(`   Total Runs:         ${iterations}`);
    console.log(`   Success Rate:       ${successRate}%`);
    console.log(`   Flakiness Score:    ${flakinessScore} (0.0 = perfect deterministic stability)`);
    console.log(`   Average Latency:    ${avgDuration} ms`);

    return {
      capabilityId: artifact.capability_id,
      totalRuns: iterations,
      successfulRuns: successCount,
      failedRuns: failCount,
      businessOutcomeRuns: outcomeCount,
      successRate,
      flakinessScore,
      averageDurationMs: avgDuration,
      durations
    };
  }
}
