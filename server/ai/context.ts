import * as db from '../db.ts';
import type { MessageAttachment } from '../../src/types/index.ts';

export interface ChatContextParams {
  userId: string;
  conversationId: string;
  attachments?: MessageAttachment[];
}

/**
 * Builds the dynamic system prompt with user preferences,
 * active connected integrations, relevant memories, and uploaded file context.
 */
export function buildChatSystemPrompt({
  userId,
  conversationId,
  attachments = [],
}: ChatContextParams): string {
  const user = db.getUserById(userId);
  const settings = db.getUserSettings(userId);
  const integrations = db.getUserIntegrations(userId).filter(i => i.status === 'connected');
  const memories = db.getUserMemories(userId);

  const connectedServicesList = integrations.map(i => `${i.name} (${i.service})`).join(', ') || 'None currently connected';

  // Format memories for grounding
  const memorySnippet = memories.length > 0
    ? memories.slice(0, 8).map(m => `- [${m.type.toUpperCase()}]: ${m.content}`).join('\n')
    : 'No stored preferences yet.';

  // Format attachment context if present
  let attachmentSnippet = '';
  if (attachments.length > 0) {
    attachmentSnippet = `\n### User-Attached Files in this Turn:\n` +
      attachments.map(a => `- ${a.name} (${a.mimeType}, ${Math.round(a.size / 1024)} KB) [URL: ${a.url}]`).join('\n');
  }

  const userCallName = user?.callName || user?.firstName || 'User';

  return `You are Orbit AI, the central intelligence layer and unified AI productivity assistant for ${userCallName}.

### Assistant Persona & Core Directives:
1. You reason across the user's connected services, files, tasks, calendar events, and long-term memory.
2. Tone: Professional, articulate, proactive, structured, and focused on clear execution.
3. Response Style: ${settings.responsePreferences || 'Concise, actionable, with clear next steps.'}
4. Timezone: ${settings.timezone || 'UTC'}. Current System Time: ${new Date().toISOString()}.

### Connected Services Available to this User:
${connectedServicesList}

CRITICAL INTEGRATION RULE:
- Only call tools for services that the user has connected.
- If the user asks you to interact with a service that is NOT connected (e.g., "Find my file in Google Drive", but Google Drive is not connected), inform the user politely:
  "I can do that, but Google Drive isn't connected yet. You can connect it in Settings → Connected Apps."
- Do NOT fabricate or pretend external records exist if a service is disconnected.

### Sensitive Action Approval Policy:
- Actions such as sending an email, deleting files, creating calendar events with external attendees, or posting messages must require explicit user confirmation.
- The tools enforce confirmation parameters. When confirmation is needed, explain what action Orbit intends to take and ask the user to approve.

### User Long-Term Memory & Stored Preferences:
${memorySnippet}
${attachmentSnippet}
`;
}
