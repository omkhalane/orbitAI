import { streamText, generateText, isStepCount, type ModelMessage } from 'ai';
import { resolveModelAndCredentials } from './providers.ts';
import { createOrbitTools } from './tools/registry.ts';
import { buildChatSystemPrompt } from './context.ts';
import * as db from '../db.ts';
import type { MessageAttachment, CredentialSource } from '../../src/types/index.ts';

export interface StreamChatOptions {
  userId: string;
  conversationId: string;
  userMessage: string;
  attachments?: MessageAttachment[];
  modelId?: string;
  credentialSource?: CredentialSource;
  onChunk: (chunk: {
    type: 'text' | 'tool_call' | 'tool_result' | 'finish' | 'error' | 'model_info';
    content?: string;
    payload?: any;
    model?: string;
    provider?: string;
    source?: string;
    error?: string;
  }) => void;
}

/**
 * Helper to calculate estimated model cost in USD
 */
function calculateCost(provider: string, modelId: string, inTokens: number, outTokens: number): number {
  let inRate = 0.15 / 1_000_000; // per million
  let outRate = 0.60 / 1_000_000;

  if (modelId.includes('pro') || modelId.includes('gpt-4o') || modelId.includes('sonnet')) {
    inRate = 2.50 / 1_000_000;
    outRate = 10.00 / 1_000_000;
  }

  return Number(((inTokens * inRate) + (outTokens * outRate)).toFixed(6));
}

/**
 * Central Vercel AI SDK 7 Streaming Orchestrator
 */
export async function streamChatWithAiSdk({
  userId,
  conversationId,
  userMessage,
  attachments = [],
  modelId = 'orbit-auto',
  credentialSource = 'orbit',
  onChunk,
}: StreamChatOptions): Promise<{ fullText: string; toolCalls: any[] }> {
  // 1. Resolve model & credentials
  const hasAttachments = attachments.length > 0;
  const resolved = resolveModelAndCredentials(
    userId,
    modelId,
    credentialSource,
    userMessage,
    hasAttachments
  );

  onChunk({
    type: 'model_info',
    model: resolved.usedModelId,
    provider: resolved.provider,
    source: resolved.credentialSource,
  });

  // 2. Build system instructions with context, user memory, and integrations
  const systemPrompt = buildChatSystemPrompt({
    userId,
    conversationId,
    attachments,
  });

  // 3. Retrieve conversation history and format ModelMessages
  const previousMessages = db.getMessages(conversationId);
  const formattedHistory: ModelMessage[] = [];

  // Include up to last 12 historical turns for context window efficiency
  const historySlice = previousMessages.slice(-12);
  for (const m of historySlice) {
    if (m.role === 'user') {
      formattedHistory.push({ role: 'user', content: m.content });
    } else if (m.role === 'assistant') {
      formattedHistory.push({ role: 'assistant', content: m.content || ' ' });
    }
  }

  // Current turn user message
  let currentTurnContent = userMessage;
  if (attachments.length > 0) {
    currentTurnContent += `\n\n[Attached files: ${attachments.map(a => a.name).join(', ')}]`;
  }
  formattedHistory.push({ role: 'user', content: currentTurnContent });

  // 4. Initialize Orbit typed tools
  const tools = createOrbitTools({ userId, conversationId });

  // 5. Execute streamText with Vercel AI SDK 7
  let fullText = '';
  const recordedToolCalls: any[] = [];

  try {
    const result = streamText({
      model: resolved.model,
      system: systemPrompt,
      messages: formattedHistory,
      tools,
      stopWhen: isStepCount(5),
    });

    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        const textDelta = (part as any).text || (part as any).textDelta || '';
        fullText += textDelta;
        onChunk({ type: 'text', content: textDelta });
      } else if (part.type === 'tool-call') {
        const payload = {
          id: part.toolCallId,
          name: part.toolName,
          arguments: (part as any).args || {},
          status: 'executing',
        };
        recordedToolCalls.push(payload);
        onChunk({ type: 'tool_call', payload });
      } else if (part.type === 'tool-result') {
        const resObj = (part as any).result || {};
        const matched = recordedToolCalls.find(c => c.name === part.toolName);
        if (matched) {
          matched.result = resObj;
          matched.requiresConfirmation = resObj.requiresConfirmation;
          matched.approvalId = resObj.approvalId;
          matched.status = resObj.requiresConfirmation ? 'pending' : 'executed';
        }

        onChunk({
          type: 'tool_result',
          payload: {
            id: part.toolCallId,
            name: part.toolName,
            result: resObj,
            requiresConfirmation: resObj.requiresConfirmation,
            approvalId: resObj.approvalId,
          },
        });
      }
    }

    // 6. Record usage metrics
    const usage = await result.usage;
    const promptTokens = (usage as any).promptTokens || 120;
    const completionTokens = (usage as any).completionTokens || Math.ceil(fullText.length / 4);

    db.recordAiUsage({
      userId,
      conversationId,
      provider: resolved.provider,
      modelId: resolved.usedModelId,
      credentialSource: resolved.credentialSource,
      inputTokens: promptTokens,
      outputTokens: completionTokens,
      estimatedCost: calculateCost(resolved.provider, resolved.usedModelId, promptTokens, completionTokens),
      timestamp: new Date().toISOString(),
      status: 'success',
    });

    onChunk({
      type: 'finish',
      model: resolved.usedModelId,
      provider: resolved.provider,
      source: resolved.credentialSource,
    });

    return { fullText, toolCalls: recordedToolCalls };
  } catch (err: any) {
    console.error('[Orbit AI Orchestrator Error]:', err);
    db.recordAiUsage({
      userId,
      conversationId,
      provider: resolved.provider,
      modelId: resolved.usedModelId,
      credentialSource: resolved.credentialSource,
      inputTokens: 50,
      outputTokens: 0,
      estimatedCost: 0,
      timestamp: new Date().toISOString(),
      status: 'failed',
    });

    throw err;
  }
}

/**
 * Generate a concise conversation title using Vercel AI SDK
 */
export async function generateChatTitleWithAiSdk(firstMessage: string): Promise<string> {
  try {
    const resolved = resolveModelAndCredentials(
      'system',
      'gemini-2.5-flash',
      'orbit',
      firstMessage
    );

    const { text } = await generateText({
      model: resolved.model,
      prompt: `Generate a concise, 2 to 5 word topic title for this chat conversation. Do not use quotes or punctuation: "${firstMessage.slice(0, 150)}"`,
    });

    return text.trim().replace(/^["']|["']$/g, '').slice(0, 40) || 'Conversation';
  } catch (err) {
    return firstMessage.slice(0, 30) || 'New Conversation';
  }
}
