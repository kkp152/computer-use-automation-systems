import { z } from 'zod';

export const ExecutionStatusSchema = z.enum([
  'SUCCESS',
  'BUSINESS_OUTCOME',
  'RECOVERABLE_RESOLVED',
  'HARD_FAILURE',
  'ESCALATED',
  'ABORTED'
]);

export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;

export const StepExecutionRecordSchema = z.object({
  step_id: z.string(),
  intent: z.string(),
  action: z.string(),
  status: z.enum(['SUCCESS', 'FAILED', 'SKIPPED', 'ESCALATED']),
  resolved_locator_strategy: z.string().optional(),
  duration_ms: z.number(),
  extracted_data: z.record(z.any()).optional(),
  error_message: z.string().optional()
});

export type StepExecutionRecord = z.infer<typeof StepExecutionRecordSchema>;

export const ExecutionResultSchema = z.object({
  run_id: z.string(),
  capability_id: z.string(),
  version: z.string(),
  status: ExecutionStatusSchema,
  inputs: z.record(z.any()),
  outputs: z.record(z.any()),
  business_outcome: z.object({
    outcome_id: z.string(),
    description: z.string(),
    details: z.any().optional()
  }).optional(),
  steps_executed: z.array(StepExecutionRecordSchema),
  total_duration_ms: z.number(),
  evidence: z.object({
    log_file: z.string().optional(),
    screenshot_file: z.string().optional(),
    trace_file: z.string().optional()
  }),
  failure_details: z.object({
    step_id: z.string(),
    expected: stringValidator(),
    observed: stringValidator(),
    error: z.string()
  }).optional()
});

function stringValidator() {
  return z.string();
}

export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;
