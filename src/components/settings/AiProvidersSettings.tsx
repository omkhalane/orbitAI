import React, { useState, useEffect } from 'react';
import { 
  Key, 
  ShieldCheck, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Eye, 
  EyeOff, 
  Sparkles,
  Lock
} from 'lucide-react';
import { api } from '../../services/api.ts';
import type { AiCredential } from '../../types/index.ts';

interface ProviderMeta {
  id: 'google' | 'openai' | 'anthropic' | 'xai' | 'deepseek';
  name: string;
  placeholder: string;
  docsUrl: string;
  description: string;
  defaultTier: string;
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'google',
    name: 'Google Gemini',
    placeholder: 'AIzaSy...',
    docsUrl: 'https://aistudio.google.com/apikey',
    description: 'Powers Gemini 2.5 Pro & Flash with massive context windows and multimodal capabilities.',
    defaultTier: 'Gemini 2.5 Pro / Flash',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    placeholder: 'sk-proj-...',
    docsUrl: 'https://platform.openai.com/api-keys',
    description: 'Powers GPT-4o and OpenAI reasoning models.',
    defaultTier: 'GPT-4o & GPT-4o-mini',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    placeholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    description: 'Powers Claude 3.5 Sonnet for deep analytical code and document synthesis.',
    defaultTier: 'Claude 3.5 Sonnet',
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    placeholder: 'xai-...',
    docsUrl: 'https://console.x.ai',
    description: 'Powers Grok-2 frontier models with direct conversational reasoning.',
    defaultTier: 'Grok-2',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    placeholder: 'sk-...',
    docsUrl: 'https://platform.deepseek.com',
    description: 'Powers DeepSeek V3 and R1 for mathematics, programming, and cost-effective intelligence.',
    defaultTier: 'DeepSeek V3 / R1',
  },
];

export const AiProvidersSettings: React.FC = () => {
  const [credentials, setCredentials] = useState<AiCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeInput, setActiveInput] = useState<Record<string, string>>({});
  const [showInput, setShowInput] = useState<Record<string, boolean>>({});
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [deletingProvider, setDeletingProvider] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ provider: string; type: 'success' | 'error'; message: string } | null>(null);

  const fetchCredentials = async () => {
    try {
      setLoading(true);
      const res = await api.getAiCredentials();
      if (res.credentials) {
        setCredentials(res.credentials);
      }
    } catch (err) {
      console.error('Failed to load credentials:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const handleSaveKey = async (providerId: string) => {
    const rawKey = activeInput[providerId]?.trim();
    if (!rawKey || rawKey.length < 8) {
      setFeedback({
        provider: providerId,
        type: 'error',
        message: 'Please enter a valid API key.',
      });
      return;
    }

    setSavingProvider(providerId);
    setFeedback(null);

    try {
      const res = await api.saveAiCredential(providerId, rawKey);
      if (res.success) {
        setFeedback({
          provider: providerId,
          type: 'success',
          message: 'API key encrypted and saved successfully.',
        });
        setActiveInput(prev => ({ ...prev, [providerId]: '' }));
        await fetchCredentials();
      } else {
        setFeedback({
          provider: providerId,
          type: 'error',
          message: res.error || 'Failed to save API key.',
        });
      }
    } catch (err: any) {
      setFeedback({
        provider: providerId,
        type: 'error',
        message: err.message || 'An unexpected error occurred.',
      });
    } finally {
      setSavingProvider(null);
    }
  };

  const handleDeleteKey = async (providerId: string) => {
    if (!confirm(`Are you sure you want to remove your ${providerId.toUpperCase()} API key?`)) {
      return;
    }

    setDeletingProvider(providerId);
    try {
      const res = await api.deleteAiCredential(providerId);
      if (res.success) {
        setFeedback({
          provider: providerId,
          type: 'success',
          message: 'API key successfully removed.',
        });
        await fetchCredentials();
      }
    } catch (err: any) {
      setFeedback({
        provider: providerId,
        type: 'error',
        message: 'Failed to delete credential.',
      });
    } finally {
      setDeletingProvider(null);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Security Banner */}
      <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3 text-xs text-indigo-950">
        <div className="p-1.5 rounded-xl bg-indigo-600 text-white flex-shrink-0 mt-0.5">
          <Lock className="w-4 h-4" />
        </div>
        <div>
          <h4 className="font-bold text-indigo-900 text-sm">Secure BYOK Key Vault & Separation of Concerns</h4>
          <p className="mt-1 leading-relaxed text-indigo-800/90">
            BYOK (Bring-Your-Own-Key) credentials are encrypted with hardware-grade <strong>AES-256-GCM</strong> on the server.
            They are stored in a dedicated AI credential vault completely separated from your Google Workspace OAuth tokens.
            Your keys are decrypted solely at inference time and never exposed in browser requests or public storage.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 flex items-center justify-center text-slate-400 text-xs gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
          <span>Loading secure AI credentials...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {PROVIDERS.map((provider) => {
            const savedCred = credentials.find(c => c.provider === provider.id);
            const isSaving = savingProvider === provider.id;
            const isDeleting = deletingProvider === provider.id;
            const providerFeedback = feedback?.provider === provider.id ? feedback : null;
            const isVisible = !!showInput[provider.id];

            return (
              <div 
                key={provider.id}
                className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4 transition-all hover:border-slate-300"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{provider.name}</span>
                      {savedCred ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Key Configured ({savedCred.maskedKey})
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          Not configured
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{provider.description}</p>
                  </div>

                  <a
                    href={provider.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1 self-start sm:self-auto"
                  >
                    Get API Key ↗
                  </a>
                </div>

                {providerFeedback && (
                  <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                    providerFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    {providerFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    )}
                    <span>{providerFeedback.message}</span>
                  </div>
                )}

                {/* Input & Action buttons */}
                <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={isVisible ? 'text' : 'password'}
                      value={activeInput[provider.id] || ''}
                      onChange={(e) => setActiveInput(prev => ({ ...prev, [provider.id]: e.target.value }))}
                      placeholder={savedCred ? `Replace existing key (${savedCred.maskedKey})` : provider.placeholder}
                      className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowInput(prev => ({ ...prev, [provider.id]: !prev[provider.id] }))}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    >
                      {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      disabled={isSaving || !activeInput[provider.id]}
                      onClick={() => handleSaveKey(provider.id)}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-40"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                      Save Key
                    </button>

                    {savedCred && (
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => handleDeleteKey(provider.id)}
                        className="p-2 rounded-xl border border-red-200 bg-red-50/50 hover:bg-red-100 text-red-600 cursor-pointer transition-all disabled:opacity-40"
                        title="Remove API Key"
                      >
                        {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                {savedCred?.lastUsedAt && (
                  <div className="text-[11px] text-slate-400">
                    Last used for inference: {new Date(savedCred.lastUsedAt).toLocaleString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
