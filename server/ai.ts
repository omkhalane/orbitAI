import { streamChatWithAiSdk, generateChatTitleWithAiSdk } from './ai/orchestrator.ts';
import { SUPPORTED_MODELS, resolveModelAndCredentials } from './ai/providers.ts';
import { createOrbitTools } from './ai/tools/registry.ts';
import * as db from './db.ts';
import type { MessageAttachment, CredentialSource } from '../src/types/index.ts';

export { SUPPORTED_MODELS, resolveModelAndCredentials };

/**
 * Stream chat response wrapper using Vercel AI SDK 7
 */
export async function streamChatResponse(
  userId: string,
  conversationId: string,
  message: string,
  attachments: MessageAttachment[] = [],
  modelId = 'orbit-auto',
  credentialSource: CredentialSource = 'orbit',
  onChunk: (chunk: any) => void
): Promise<{ fullText: string; toolCalls: any[] }> {
  return streamChatWithAiSdk({
    userId,
    conversationId,
    userMessage: message,
    attachments,
    modelId,
    credentialSource,
    onChunk,
  });
}

/**
 * Title generation using Vercel AI SDK
 */
export async function generateChatTitle(message: string): Promise<string> {
  return generateChatTitleWithAiSdk(message);
}

/**
 * Direct tool execution dispatcher (for user approvals and confirmed actions)
 */
export async function executeToolCall(
  userId: string,
  toolName: string,
  args: Record<string, any>,
  conversationId = ''
): Promise<{ result: any; requiresConfirmation?: boolean }> {
  const tools = createOrbitTools({ userId, conversationId });
  const toolFn = (tools as any)[toolName];

  if (!toolFn) {
    throw new Error(`Tool "${toolName}" is not registered in Orbit AI.`);
  }

  try {
    const result = await toolFn.execute(args);
    return {
      result,
      requiresConfirmation: result?.requiresConfirmation,
    };
  } catch (err: any) {
    console.error(`Error executing tool ${toolName}:`, err);
    throw new Error(`Tool execution failed: ${err.message}`);
  }
}
