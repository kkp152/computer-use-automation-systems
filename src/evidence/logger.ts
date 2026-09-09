import fs from 'node:fs';
import path from 'node:path';
import { Page } from 'playwright';
import { PiiRedactor } from '../safety/pii-redactor.js';

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'STEP' | 'ESCALATE';
  message: string;
  context?: Record<string, any>;
}

export class ExecutionLogger {
  private runId: string;
  private logs: LogEntry[] = [];
  private outputDir: string;
  private logFilePath: string;

  constructor(runId: string, outputDir: string = './evidence') {
    this.runId = runId;
    this.outputDir = outputDir;
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    this.logFilePath = path.join(this.outputDir, `${runId}.log`);
  }

  public log(level: LogEntry['level'], message: string, context?: Record<string, any>) {
    const timestamp = new Date().toISOString();
    const redactedMessage = PiiRedactor.redactText(message);
    const redactedContext = context ? PiiRedactor.redactObject(context) : undefined;

    const entry: LogEntry = {
      timestamp,
      level,
      message: redactedMessage,
      context: redactedContext
    };

    this.logs.push(entry);

    // Format console output with clear badges
    const ctxString = redactedContext ? ` | ${JSON.stringify(redactedContext)}` : '';
    const formattedLine = `[${timestamp}] [${level.padEnd(5)}] ${redactedMessage}${ctxString}`;
    console.log(formattedLine);

    // Append to run log file
    fs.appendFileSync(this.logFilePath, formattedLine + '\n', 'utf-8');
  }

  public info(message: string, context?: Record<string, any>) {
    this.log('INFO', message, context);
  }

  public warn(message: string, context?: Record<string, any>) {
    this.log('WARN', message, context);
  }

  public error(message: string, context?: Record<string, any>) {
    this.log('ERROR', message, context);
  }

  public step(message: string, context?: Record<string, any>) {
    this.log('STEP', message, context);
  }

  public escalate(message: string, context?: Record<string, any>) {
    this.log('ESCALATE', message, context);
  }

  /**
   * Captures a screenshot to the evidence directory.
   */
  public async captureScreenshot(page: Page, label: string): Promise<string> {
    try {
      const filename = `${this.runId}_${label}_${Date.now()}.png`;
      const fullPath = path.join(this.outputDir, filename);
      await page.screenshot({ path: fullPath, fullPage: true });
      this.info(`Captured evidence screenshot: ${filename}`);
      return fullPath;
    } catch (err: any) {
      this.warn(`Failed to capture screenshot: ${err.message}`);
      return '';
    }
  }

  /**
   * Saves execution timeline JSON.
   */
  public saveTrace(data: Record<string, any>): string {
    const tracePath = path.join(this.outputDir, `${this.runId}_trace.json`);
    const sanitized = PiiRedactor.redactObject({
      runId: this.runId,
      timestamp: new Date().toISOString(),
      logs: this.logs,
      ...data
    });
    fs.writeFileSync(tracePath, JSON.stringify(sanitized, null, 2), 'utf-8');
    this.info(`Saved structured execution trace: ${tracePath}`);
    return tracePath;
  }

  public getLogFilePath(): string {
    return this.logFilePath;
  }
}
