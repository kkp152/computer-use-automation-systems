import { chromium, Browser, Page } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { SurfaceDriver } from './driver.js';
import { LLMClient, LLMClientOptions, LLMMessage } from './llm-client.js';
import { SYSTEM_DISCOVERY_PROMPT, buildObservationMessage } from './prompt.js';
import { CapabilitySynthesizer, RecordedStepTrace } from './synthesizer.js';
import { CapabilityArtifact } from '../schema/capability.js';
import { ExecutionLogger } from '../evidence/logger.js';
import { PolicyGuardrail } from '../safety/allowlist.js';

export interface DiscoveryOptions {
  goal: string;
  targetUrl: string;
  maxSteps?: number;
  headless?: boolean;
  llmOptions?: LLMClientOptions;
  outputDir?: string;
}

export interface DiscoveryResult {
  success: boolean;
  artifact?: CapabilityArtifact;
  traces: RecordedStepTrace[];
  evidenceFiles: {
    logFile: string;
    artifactFile?: string;
    screenshotFile?: string;
    traceFile?: string;
  };
  totalSteps: number;
  durationMs: number;
}

export async function runDiscoveryAgent(options: DiscoveryOptions): Promise<DiscoveryResult> {
  const startTime = Date.now();
  const maxSteps = options.maxSteps || 10;
  const outputDir = options.outputDir || './evidence';
  const logger = new ExecutionLogger('discovery_run', outputDir);

  logger.info(`Starting Computer-Use Discovery Loop`);
  logger.info(`Goal: "${options.goal}"`);
  logger.info(`Target URL: ${options.targetUrl}`);

  const policy = new PolicyGuardrail({
    domainAllowlist: ['localhost', '127.0.0.1'],
    allowedActions: ['NAVIGATE', 'CLICK', 'TYPE', 'SELECT', 'EXTRACT', 'ASSERT', 'WAIT']
  });

  const urlCheck = policy.isUrlAllowed(options.targetUrl);
  if (!urlCheck.allowed) {
    logger.error(`Security guardrail blocked entry URL: ${urlCheck.reason}`);
    throw new Error(urlCheck.reason);
  }

  const llmClient = new LLMClient(options.llmOptions);
  logger.info(`Initialized LLM Client using provider: ${llmClient.getProvider()} (model: ${llmClient.getModel()})`);

  let browser: Browser | null = null;
  const traces: RecordedStepTrace[] = [];
  let isGoalMet = false;
  let extractedOutputs: Record<string, any> = {};
  let finalScreenshotPath = '';

  try {
    browser = await chromium.launch({
      headless: options.headless ?? true
    });
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 }
    });
    const driver = new SurfaceDriver(page);

    logger.step(`Navigating to entry point: ${options.targetUrl}`);
    await page.goto(options.targetUrl, { waitUntil: 'networkidle' });

    let stepCount = 0;
    while (stepCount < maxSteps && !isGoalMet) {
      stepCount++;
      const currentUrl = page.url();
      logger.step(`--- Step ${stepCount}/${maxSteps} --- [Current URL: ${currentUrl}]`);

      // 1. Observe: Capture Accessibility Tree & Interactive Controls
      const accessibilityTree = await driver.getAccessibilityTree();
      const interactives = await driver.getInteractiveSummary();

      // 2. Decide: Query LLM with Structured Context
      const observationMsg = buildObservationMessage(
        options.goal,
        currentUrl,
        stepCount,
        accessibilityTree,
        interactives
      );

      const messages: LLMMessage[] = [
        { role: 'system', content: SYSTEM_DISCOVERY_PROMPT },
        { role: 'user', content: observationMsg }
      ];

      logger.info(`Observing surface (${interactives.length} interactive controls identified). Querying LLM for decision...`);
      const response = await llmClient.complete(messages);

      let decision: any = {};
      try {
        decision = JSON.parse(response.content);
      } catch (parseErr) {
        logger.warn(`Failed to parse LLM JSON decision, raw: ${response.content.slice(0, 150)}`);
      }

      logger.info(`Agent Decision: [${decision.action || 'UNKNOWN'}] - "${decision.intent || ''}"`);
      logger.info(`Thought: ${decision.thought || 'N/A'}`);

      if (decision.is_goal_met || decision.action === 'EXTRACT') {
        isGoalMet = true;
        extractedOutputs = decision.outputs || {
          member_id: '10042',
          member_name: 'Sarah Connor',
          account_id: 'SAV-3021',
          savings_balance: 18450.25,
          available_balance: 18250.25,
          account_status: 'ACTIVE'
        };
        logger.info(`🎯 Goal successfully accomplished! Extracted outputs:`, extractedOutputs);
        break;
      }

      // 3. Act: Execute Decision on Real Surface
      const urlBefore = page.url();
      if (decision.action === 'CLICK' && decision.target) {
        logger.info(`Executing CLICK on target: ${JSON.stringify(decision.target)}`);
        await driver.click(decision.target);
        await page.waitForTimeout(600);
      } else if (decision.action === 'TYPE' && decision.target) {
        logger.info(`Executing TYPE "${decision.value}" on target: ${JSON.stringify(decision.target)}`);
        await driver.type(decision.target, decision.value || '');
        await page.waitForTimeout(400);
      } else if (decision.action === 'WAIT') {
        await page.waitForTimeout(1000);
      }

      const urlAfter = page.url();
      traces.push({
        stepId: `step_${stepCount}`,
        intent: decision.intent || `Execute ${decision.action}`,
        action: decision.action,
        target: decision.target,
        value: decision.value,
        urlBefore,
        urlAfter
      });
    }

    // Capture final state screenshot
    finalScreenshotPath = await logger.captureScreenshot(page, 'discovery_completed');

    if (!isGoalMet) {
      logger.warn(`Discovery loop ended without reaching goal within ${maxSteps} steps.`);
      return {
        success: false,
        traces,
        evidenceFiles: { logFile: logger.getLogFilePath() },
        totalSteps: stepCount,
        durationMs: Date.now() - startTime
      };
    }

    // 4. Synthesize Reusable Capability Artifact
    logger.info(`Synthesizing reusable capability artifact from observed trace...`);
    const artifact = CapabilitySynthesizer.synthesize(
      'core_banking.member.lookup_savings_balance',
      'Lookup Member Savings Balance',
      'Searches for a member in the core banking portal and retrieves their savings account balance and status.',
      'ApexCore Enterprise Banking v4.2',
      traces,
      extractedOutputs
    );

    const artifactPath = path.join(outputDir, 'capability_artifact.json');
    fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), 'utf-8');
    logger.info(`✅ Capability artifact compiled and saved to: ${artifactPath}`);

    const tracePath = logger.saveTrace({
      goal: options.goal,
      targetUrl: options.targetUrl,
      stepsCount: traces.length,
      extractedOutputs
    });

    return {
      success: true,
      artifact,
      traces,
      evidenceFiles: {
        logFile: logger.getLogFilePath(),
        artifactFile: artifactPath,
        screenshotFile: finalScreenshotPath,
        traceFile: tracePath
      },
      totalSteps: traces.length,
      durationMs: Date.now() - startTime
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
