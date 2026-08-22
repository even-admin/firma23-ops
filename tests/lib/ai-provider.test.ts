import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import {
  AiProviderUnavailableError,
  describeAiProviderStatus,
  extractContractFieldsLive,
  isLiveAiProviderConfigured,
} from '@/lib/ai/provider';

function fakeAnthropicClient(create: (...args: unknown[]) => unknown): Anthropic {
  return { messages: { create } } as unknown as Anthropic;
}

describe('AI provider boundary', () => {
  it('reports local mode when no credential is configured', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect(isLiveAiProviderConfigured()).toBe(false);
    expect(describeAiProviderStatus().mode).toBe('local');
    vi.unstubAllEnvs();
  });

  it('reports live mode once a credential is configured', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    expect(isLiveAiProviderConfigured()).toBe(true);
    expect(describeAiProviderStatus().mode).toBe('live');
    vi.unstubAllEnvs();
  });

  it('refuses to call the model at all without a configured credential', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    await expect(extractContractFieldsLive('cualquier texto')).rejects.toThrow(
      AiProviderUnavailableError,
    );
    vi.unstubAllEnvs();
  });

  it('forces the extraction tool and validates a well-formed response', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    const create = vi.fn().mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'call_1',
          name: 'record_contract_extraction',
          input: {
            sponsorName: {
              value: 'Secretaría de Economía y Trabajo de Yucatán',
              confidence: 'high',
              evidence: [{ locationLabel: 'Encabezado', quote: 'Secretaría de Economía...' }],
            },
            programName: null,
            reviewIssues: [
              { key: 'x', severity: 'missing', fieldLabel: 'Programa', detail: 'No aparece.' },
            ],
          },
        },
      ],
    });
    const result = await extractContractFieldsLive('texto del documento', fakeAnthropicClient(create));

    expect(result.sponsorName?.value).toBe('Secretaría de Economía y Trabajo de Yucatán');
    expect(result.programName).toBeNull();
    expect(result.reviewIssues).toHaveLength(1);

    const call = create.mock.calls[0]?.[0];
    expect(call.tool_choice).toEqual({ type: 'tool', name: 'record_contract_extraction' });
    expect(call.tools[0].strict).toBe(true);
    expect(call.model).toBe('claude-opus-5');
    vi.unstubAllEnvs();
  });

  it('rejects a response that omits required evidence', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    const create = vi.fn().mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'call_1',
          name: 'record_contract_extraction',
          input: {
            sponsorName: { value: 'x', confidence: 'high', evidence: [] },
            programName: null,
            reviewIssues: [],
          },
        },
      ],
    });
    await expect(extractContractFieldsLive('texto', fakeAnthropicClient(create))).rejects.toThrow();
    vi.unstubAllEnvs();
  });
});
