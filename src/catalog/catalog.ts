import fs from 'node:fs';
import path from 'node:path';
import { CapabilityArtifact, CapabilityArtifactSchema } from '../schema/capability.js';
import { DeterministicReplayEngine } from '../replay/executor.js';
import { ExecutionResult } from '../schema/execution-result.js';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export class CapabilityCatalog {
  private capabilities: Map<string, CapabilityArtifact> = new Map();
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Registers a capability artifact from a file or object.
   */
  public register(artifact: CapabilityArtifact): void {
    const validated = CapabilityArtifactSchema.parse(artifact);
    this.capabilities.set(validated.capability_id, validated);
  }

  /**
   * Loads capability artifacts from a directory.
   */
  public loadFromDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) return;
    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(dirPath, file), 'utf-8');
        const json = JSON.parse(content);
        if (json.capability_id && json.inputs_schema && json.steps) {
          this.register(json);
        }
      } catch (e) {
        // Skip invalid non-capability JSON files
      }
    }
  }

  /**
   * Lists all available capabilities formatted as standard LLM Tool Calling schemas.
   */
  public getToolDefinitions(): ToolDefinition[] {
    const tools: ToolDefinition[] = [];

    for (const [id, cap] of this.capabilities.entries()) {
      tools.push({
        name: id.replace(/\./g, '_'),
        description: cap.description,
        parameters: {
          type: 'object',
          properties: cap.inputs_schema.properties,
          required: cap.inputs_schema.required
        }
      });
    }

    return tools;
  }

  /**
   * Invocable capability dispatch: AI agents invoke capabilities by ID with typed arguments.
   */
  public async invoke(capabilityId: string, inputs: Record<string, any>): Promise<ExecutionResult> {
    const capability = this.capabilities.get(capabilityId);
    if (!capability) {
      throw new Error(`Capability "${capabilityId}" not found in catalog. Available: [${Array.from(this.capabilities.keys()).join(', ')}]`);
    }

    const replayEngine = new DeterministicReplayEngine(capability, {
      baseUrl: this.baseUrl,
      headless: true
    });

    return await replayEngine.execute(inputs);
  }
}
