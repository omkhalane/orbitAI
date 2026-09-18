export type AuthProvider = 'google' | 'microsoft' | 'email';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  callName: string;
  avatar?: string;
  provider: AuthProvider;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type IntegrationProvider = 'google' | 'microsoft' | 'slack' | 'notion' | 'dropbox' | 'firebase' | 'cloudsql';

export type IntegrationService = 
  | 'gmail'
  | 'google_calendar'
  | 'google_drive'
  | 'google_docs'
  | 'google_sheets'
  | 'google_slides'
  | 'google_tasks'
  | 'google_chat'
  | 'google_forms'
  | 'google_keep'
  | 'google_meet'
  | 'google_contacts'
  | 'google_picker'
  | 'google_classroom'
  | 'firebase_firestore'
  | 'cloud_sql'
  | 'google_maps'
  | 'outlook'
  | 'outlook_calendar'
  | 'onedrive'
  | 'ms_todo'
  | 'teams'
  | 'slack'
  | 'notion'
  | 'dropbox';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'syncing';

export interface Integration {
  id: string;
  userId: string;
  provider: IntegrationProvider;
  service: IntegrationService;
  name: string;
  status: IntegrationStatus;
  permissions: string[];
  lastSynced?: string;
  accountEmail?: string;
  error?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

export interface ToolCallPayload {
  id: string;
  name: string;
  arguments: Record<string, any>;
  requiresConfirmation?: boolean;
  approvalId?: string;
  status?: 'pending' | 'executed' | 'confirmed' | 'cancelled' | 'failed';
  result?: any;
}

export interface MessageAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  status: 'uploading' | 'processing' | 'ready';
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  toolCalls?: ToolCallPayload[];
  attachments?: MessageAttachment[];
  isStreaming?: boolean;
  error?: string;
}

export interface MemoryItem {
  id: string;
  userId: string;
  source: 'user_created' | 'uploaded_file' | 'connected_app' | 'conversation';
  type: 'preference' | 'instruction' | 'work_context' | 'fact';
  content: string;
  metadata?: Record<string, any>;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface TaskItem {
  id: string;
  userId: string;
  title: string;
  dueTime?: string;
  status: 'pending' | 'in_progress' | 'completed';
  source: 'orbit_ai' | 'user' | 'gmail' | 'calendar';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledTask {
  id: string;
  userId: string;
  title: string;
  prompt: string;
  cronExpression: string;
  scheduleDescription: string;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  lastResult?: string;
  createdAt: string;
}

export interface SpecializedAgent {
  id: string;
  userId: string;
  name: string;
  description: string;
  instructions: string;
  tools: string[];
  icon: string;
  status: 'active' | 'draft';
  createdAt: string;
}

export interface UserSettings {
  userId: string;
  theme: 'light' | 'system';
  responsePreferences: string;
  timezone: string;
  emailNotifications: boolean;
  autoTitleEnabled: boolean;
  voiceInputLanguage: string;
  defaultModel?: string;
  defaultCredentialSource?: 'orbit' | 'byok';
}

export type AiProviderId = 'google' | 'openai' | 'anthropic' | 'xai' | 'deepseek' | 'mistral';

export type CredentialSource = 'orbit' | 'byok';

export interface AiModelInfo {
  id: string;
  name: string;
  provider: AiProviderId;
  description: string;
  capabilities: {
    tools: boolean;
    vision: boolean;
    reasoning: boolean;
    streaming: boolean;
  };
  contextWindow: number;
  isOrbitSupported: boolean;
  isByokSupported: boolean;
  tier: 'fast' | 'standard' | 'reasoning' | 'pro';
}

export interface AiCredential {
  id: string;
  userId: string;
  provider: AiProviderId;
  credentialType: 'api_key';
  maskedKey: string;
  status: 'valid' | 'invalid' | 'untested';
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

export interface OAuthConnection {
  id: string;
  userId: string;
  provider: string;
  accountEmail?: string;
  scopes: string[];
  expiresAt?: number;
  status: 'connected' | 'expired' | 'revoked';
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface AiUsageRecord {
  id: string;
  userId: string;
  conversationId?: string;
  provider: string;
  modelId: string;
  credentialSource: CredentialSource;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  estimatedCost: number;
  timestamp: string;
  status: 'success' | 'failed';
}

export interface ToolApprovalRequest {
  id: string;
  userId: string;
  conversationId: string;
  toolCallId: string;
  toolName: string;
  actionType: string;
  actionDescription: string;
  parameters: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface AiEntitlement {
  plan: 'orbit_starter' | 'orbit_pro' | 'orbit_team';
  monthlyAiLimit: number;
  currentUsageTokens: number;
  remainingTokens: number;
  allowedModels: string[];
  byokAllowed: boolean;
}
