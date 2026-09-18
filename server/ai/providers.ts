import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';
import * as db from '../db.ts';
import type { AiModelInfo, AiProviderId, CredentialSource } from '../../src/types/index.ts';

// Comprehensive registry of supported models with verified capabilities
export const SUPPORTED_MODELS: AiModelInfo[] = [
  {
    id: 'orbit-auto',
    name: 'Orbit Auto',
    provider: 'google',
    description: 'Intelligent dynamic router: automatically selects the optimal model based on prompt complexity, tools, and attachments.',
    capabilities: {
      tools: true,
      vision: true,
      reasoning: true,
      streaming: true,
    },
    contextWindow: 1048576,
    isOrbitSupported: true,
    isByokSupported: true,
    tier: 'pro',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    description: 'Flagship reasoning and multimodal model with deep analysis and large context window.',
    capabilities: {
      tools: true,
      vision: true,
      reasoning: true,
      streaming: true,
    },
    contextWindow: 1048576,
    isOrbitSupported: true,
    isByokSupported: true,
    tier: 'pro',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    description: 'High-speed, low-latency versatile model for fast routine tasks and search.',
    capabilities: {
      tools: true,
      vision: true,
      reasoning: false,
      streaming: true,
    },
    contextWindow: 1048576,
    isOrbitSupported: true,
    isByokSupported: true,
    tier: 'fast',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o (OpenAI)',
    provider: 'openai',
    description: 'OpenAI flagship multimodal model with strong cross-domain instruction following.',
    capabilities: {
      tools: true,
      vision: true,
      reasoning: true,
      streaming: true,
    },
    contextWindow: 128000,
    isOrbitSupported: false,
    isByokSupported: true,
    tier: 'standard',
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    description: 'Anthropic state-of-the-art model with exceptional coding, writing, and nuanced reasoning.',
    capabilities: {
      tools: true,
      vision: true,
      reasoning: true,
      streaming: true,
    },
    contextWindow: 200000,
    isOrbitSupported: false,
    isByokSupported: true,
    tier: 'pro',
  },
  {
    id: 'grok-2',
    name: 'Grok-2 (xAI)',
    provider: 'xai',
    description: 'xAI frontier model with real-time knowledge and direct analytical reasoning.',
    capabilities: {
      tools: true,
      vision: true,
      reasoning: true,
      streaming: true,
    },
    contextWindow: 131072,
    isOrbitSupported: false,
    isByokSupported: true,
    tier: 'standard',
  },
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3 / R1',
    provider: 'deepseek',
    description: 'Advanced open-architecture model with strong mathematical, code, and analytical performance.',
    capabilities: {
      tools: true,
      vision: false,
      reasoning: true,
      streaming: true,
    },
    contextWindow: 64000,
    isOrbitSupported: false,
    isByokSupported: true,
    tier: 'standard',
  },
];

export interface ResolvedModelConfig {
  model: LanguageModel;
  modelInfo: AiModelInfo;
  provider: AiProviderId;
  credentialSource: CredentialSource;
  usedModelId: string;
}

/**
 * Intelligent "Orbit Auto" routing algorithm:
 * Dynamically resolves to the best available model based on the prompt characteristics,
 * attachments, tool requirements, and user credentials.
 */
export function resolveOrbitAuto(
  userId: string,
  userMessage: string,
  hasAttachments: boolean,
  credentialPreference: CredentialSource
): { targetModelId: string; targetProvider: AiProviderId } {
  const byokCredentials = db.getAiCredentials(userId);
  const byokProviders = byokCredentials.map(c => c.provider);

  const lowerMsg = userMessage.toLowerCase();
  const isComplexReasoning = 
    lowerMsg.includes('analyze') ||
    lowerMsg.includes('strategy') ||
    lowerMsg.includes('compare') ||
    lowerMsg.includes('debug') ||
    lowerMsg.includes('synthesize') ||
    userMessage.length > 400;

  // If user requested BYOK and has Anthropic connected and task is deep reasoning:
  if (credentialPreference === 'byok') {
    if (byokProviders.includes('anthropic') && isComplexReasoning) {
      return { targetModelId: 'claude-3-5-sonnet', targetProvider: 'anthropic' };
    }
    if (byokProviders.includes('openai')) {
      return { targetModelId: 'gpt-4o', targetProvider: 'openai' };
    }
    if (byokProviders.includes('google')) {
      return isComplexReasoning
        ? { targetModelId: 'gemini-2.5-pro', targetProvider: 'google' }
        : { targetModelId: 'gemini-2.5-flash', targetProvider: 'google' };
    }
  }

  // Orbit-managed access defaults to Gemini Pro for complex or multimodal tasks, and Flash for speed
  if (isComplexReasoning || hasAttachments) {
    return { targetModelId: 'gemini-2.5-pro', targetProvider: 'google' };
  }

  return { targetModelId: 'gemini-2.5-flash', targetProvider: 'google' };
}

/**
 * Central Model & Credential Resolver
 * Resolves the appropriate Vercel AI SDK LanguageModelV1 instance and credential
 */
export function resolveModelAndCredentials(
  userId: string,
  requestedModelId = 'orbit-auto',
  requestedSource: CredentialSource = 'orbit',
  userMessage = '',
  hasAttachments = false
): ResolvedModelConfig {
  let activeModelId = requestedModelId;
  let activeSource = requestedSource;

  // Handle Orbit Auto dynamic resolution
  if (activeModelId === 'orbit-auto') {
    const autoResolved = resolveOrbitAuto(userId, userMessage, hasAttachments, activeSource);
    activeModelId = autoResolved.targetModelId;
  }

  const modelInfo = SUPPORTED_MODELS.find(m => m.id === activeModelId) || SUPPORTED_MODELS[1]; // default Gemini 2.5 Pro
  const provider = modelInfo.provider;

  // Check credential source
  let apiKey = '';

  if (activeSource === 'byok') {
    const decryptedKey = db.getDecryptedAiCredential(userId, provider);
    if (!decryptedKey) {
      // If BYOK requested but not configured, fallback to Orbit-managed if provider is Google, or throw friendly error
      if (modelInfo.isOrbitSupported && process.env.GEMINI_API_KEY) {
        console.warn(`[Orbit AI] BYOK key for ${provider} not found. Falling back to Orbit-managed tier.`);
        activeSource = 'orbit';
        apiKey = process.env.GEMINI_API_KEY;
      } else {
        throw new Error(
          `No API Key configured for ${provider.toUpperCase()}. Please add your API key in Settings → AI Providers to use ${modelInfo.name}, or switch Model Source to "Orbit".`
        );
      }
    } else {
      apiKey = decryptedKey;
      db.markAiCredentialUsed(userId, provider);
    }
  } else {
    // Orbit-managed tier
    if (provider === 'google') {
      apiKey = process.env.GEMINI_API_KEY || '';
      if (!apiKey) {
        throw new Error('Orbit-managed AI service is currently configuring credentials. Please configure GEMINI_API_KEY or provide your own API key in Settings.');
      }
    } else if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      apiKey = process.env.OPENAI_API_KEY;
    } else if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      apiKey = process.env.ANTHROPIC_API_KEY;
    } else {
      // Provider not in Orbit-managed tier, check if user has BYOK
      const decryptedKey = db.getDecryptedAiCredential(userId, provider);
      if (decryptedKey) {
        apiKey = decryptedKey;
        activeSource = 'byok';
        db.markAiCredentialUsed(userId, provider);
      } else {
        throw new Error(
          `${modelInfo.name} requires a direct API key. Please connect your ${provider.toUpperCase()} API key in Settings → AI Providers.`
        );
      }
    }
  }

  // Instantiate provider via Vercel AI SDK
  let modelInstance: LanguageModel;

  switch (provider) {
    case 'google': {
      const googleProvider = createGoogleGenerativeAI({ apiKey });
      const googleModelName = activeModelId.includes('flash') ? 'gemini-2.5-flash' : 'gemini-2.5-pro';
      modelInstance = googleProvider(googleModelName);
      break;
    }

    case 'openai': {
      const openaiProvider = createOpenAI({ apiKey });
      modelInstance = openaiProvider(activeModelId === 'gpt-4o' ? 'gpt-4o' : 'gpt-4o-mini');
      break;
    }

    case 'anthropic': {
      const anthropicProvider = createAnthropic({ apiKey });
      modelInstance = anthropicProvider('claude-3-5-sonnet-20241022');
      break;
    }

    case 'xai': {
      // xAI uses OpenAI-compatible API endpoint
      const xaiProvider = createOpenAI({
        baseURL: 'https://api.x.ai/v1',
        apiKey,
      });
      modelInstance = xaiProvider('grok-2-1212');
      break;
    }

    case 'deepseek': {
      // DeepSeek uses OpenAI-compatible API endpoint
      const deepseekProvider = createOpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey,
      });
      modelInstance = deepseekProvider('deepseek-chat');
      break;
    }

    default: {
      const fallbackGoogle = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY || apiKey });
      modelInstance = fallbackGoogle('gemini-2.5-flash');
      break;
    }
  }

  return {
    model: modelInstance,
    modelInfo,
    provider,
    credentialSource: activeSource,
    usedModelId: activeModelId,
  };
}
