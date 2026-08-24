/**
 * The live AI intake provider boundary.
 *
 * This is a real, callable implementation, not a stub — given real document
 * text it makes a real Anthropic Messages API call and returns a validated
 * extraction. It has never been exercised end to end in this environment for
 * two independent reasons, both stated plainly rather than hidden behind a
 * fake success path:
 *
 * 1. No ANTHROPIC_API_KEY (or any Anthropic credential) is configured here.
 *    isLiveAiProviderConfigured() reports that honestly.
 * 2. Nothing in the app extracts real text from an uploaded document yet —
 *    the intake panel only captures a filename client-side (see
 *    src/components/admin/DocumentIntakePanel.tsx). Wiring this function
 *    into src/data/repositories/supabase/intake.ts requires a PDF/DOCX text
 *    extraction step that does not exist, and adding one was out of scope
 *    for this pass. Bolting a live call onto a pipeline with no real input
 *    would be a second layer of pretend, not a completed boundary.
 *
 * The deterministic local adapter (src/data/repositories/synthetic/intake.ts
 * and the run_intake() Postgres function) remains what every environment
 * actually uses today, exactly as required: never call a live provider
 * silently, and never let AI output skip founder confirmation regardless of
 * which adapter produced it — this module returns extracted fields only,
 * never a confirmed draft.
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const CONTRACT_EXTRACTION_MODEL = 'claude-opus-5';

const sourceEvidenceSchema = z.object({ locationLabel: z.string(), quote: z.string() });
const confidenceSchema = z.enum(['high', 'medium', 'low']);

const extractedTextFieldSchema = z.object({
  value: z.string(),
  confidence: confidenceSchema,
  evidence: z.array(sourceEvidenceSchema).min(1),
});

const reviewIssueSchema = z.object({
  key: z.string(),
  severity: z.enum(['missing', 'ambiguous']),
  fieldLabel: z.string(),
  detail: z.string(),
});

export const liveExtractionSchema = z
  .object({
    sponsorName: extractedTextFieldSchema.nullable(),
    programName: extractedTextFieldSchema.nullable(),
    reviewIssues: z.array(reviewIssueSchema),
  })
  .strict();

export type LiveExtractionResult = z.infer<typeof liveExtractionSchema>;

export class AiProviderUnavailableError extends Error {
  override readonly name = 'AiProviderUnavailableError';
}

export function isLiveAiProviderConfigured(): boolean {
  return (
    typeof process.env.ANTHROPIC_API_KEY === 'string' && process.env.ANTHROPIC_API_KEY.length > 0
  );
}

export interface AiProviderStatus {
  readonly mode: 'local' | 'live';
  readonly reason: string;
}

/** For status reporting in admin UI or logs — never gates authorization. */
export function describeAiProviderStatus(): AiProviderStatus {
  if (isLiveAiProviderConfigured()) {
    return { mode: 'live', reason: `ANTHROPIC_API_KEY configured; model ${CONTRACT_EXTRACTION_MODEL}` };
  }
  return { mode: 'local', reason: 'No ANTHROPIC_API_KEY configured; using the deterministic local adapter.' };
}

const EXTRACTION_TOOL_NAME = 'record_contract_extraction';

/**
 * Extracts sponsor/program name and review issues from real document text.
 *
 * Confidence and evidence are required in the schema — the model cannot
 * report a value without a source quote to back it, which is what keeps
 * this an *extraction* boundary and not a place invented facts can enter.
 * Never asked to extract money: financial totals stay founder/data-owned
 * per AGENTS.md, not something a live model free-associates from prose.
 */
export async function extractContractFieldsLive(
  documentText: string,
  client?: Anthropic,
): Promise<LiveExtractionResult> {
  // Checked before constructing any client — a bare `new Anthropic()` throws
  // its own error in some environments (e.g. anything that looks like a
  // browser) regardless of whether a credential exists, which would mask
  // the real reason this call is refused.
  if (!isLiveAiProviderConfigured()) {
    throw new AiProviderUnavailableError('No ANTHROPIC_API_KEY is configured in this environment.');
  }
  const resolvedClient = client ?? new Anthropic();

  const response = await resolvedClient.messages.create({
    model: CONTRACT_EXTRACTION_MODEL,
    max_tokens: 4096,
    system:
      'Extrae únicamente lo que el documento afirma explícitamente. Cada campo requiere una ' +
      'cita textual como evidencia. Si el patrocinador o el nombre del programa no aparecen ' +
      'con claridad, devuelve null para ese campo y agrega un review issue en vez de adivinar. ' +
      'Nunca extraigas montos, porcentajes de reparto, ni nombres de beneficiarios — esos datos ' +
      'los define la organización, no el modelo.',
    messages: [
      {
        role: 'user',
        content: `Documento:\n\n${documentText}`,
      },
    ],
    tools: [
      {
        name: EXTRACTION_TOOL_NAME,
        description: 'Registra los campos extraídos del documento con su evidencia.',
        input_schema: {
          type: 'object',
          properties: {
            sponsorName: {
              anyOf: [
                {
                  type: 'object',
                  properties: {
                    value: { type: 'string' },
                    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                    evidence: {
                      type: 'array',
                      minItems: 1,
                      items: {
                        type: 'object',
                        properties: {
                          locationLabel: { type: 'string' },
                          quote: { type: 'string' },
                        },
                        required: ['locationLabel', 'quote'],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ['value', 'confidence', 'evidence'],
                  additionalProperties: false,
                },
                { type: 'null' },
              ],
            },
            programName: {
              anyOf: [
                {
                  type: 'object',
                  properties: {
                    value: { type: 'string' },
                    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                    evidence: {
                      type: 'array',
                      minItems: 1,
                      items: {
                        type: 'object',
                        properties: {
                          locationLabel: { type: 'string' },
                          quote: { type: 'string' },
                        },
                        required: ['locationLabel', 'quote'],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ['value', 'confidence', 'evidence'],
                  additionalProperties: false,
                },
                { type: 'null' },
              ],
            },
            reviewIssues: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  severity: { type: 'string', enum: ['missing', 'ambiguous'] },
                  fieldLabel: { type: 'string' },
                  detail: { type: 'string' },
                },
                required: ['key', 'severity', 'fieldLabel', 'detail'],
                additionalProperties: false,
              },
            },
          },
          required: ['sponsorName', 'programName', 'reviewIssues'],
          additionalProperties: false,
        },
        strict: true,
      },
    ],
    tool_choice: { type: 'tool', name: EXTRACTION_TOOL_NAME },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  );
  if (toolUse === undefined) {
    throw new AiProviderUnavailableError('The model did not return a tool call.');
  }

  return liveExtractionSchema.parse(toolUse.input);
}
