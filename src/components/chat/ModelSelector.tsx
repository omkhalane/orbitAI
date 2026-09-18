import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  ChevronDown, 
  Check, 
  Zap, 
  ShieldCheck, 
  Key, 
  Settings2,
  Cpu
} from 'lucide-react';
import { api } from '../../services/api.ts';
import type { AiModelInfo, CredentialSource, AiCredential } from '../../types/index.ts';

interface ModelSelectorProps {
  selectedModelId: string;
  selectedSource: CredentialSource;
  onSelectModel: (modelId: string) => void;
  onSelectSource: (source: CredentialSource) => void;
  activeStreamingModel?: string;
  onOpenSettings?: () => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModelId,
  selectedSource,
  onSelectModel,
  onSelectSource,
  activeStreamingModel,
  onOpenSettings,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [models, setModels] = useState<AiModelInfo[]>([]);
  const [credentials, setCredentials] = useState<AiCredential[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchModelsAndCreds = async () => {
      try {
        setLoading(true);
        const [modelsRes, credsRes] = await Promise.all([
          api.getAiModels(),
          api.getAiCredentials(),
        ]);
        if (isMounted) {
          if (modelsRes.models && modelsRes.models.length > 0) {
            setModels(modelsRes.models);
          }
          if (credsRes.credentials) {
            setCredentials(credsRes.credentials);
          }
        }
      } catch (err) {
        console.error('Failed to load models:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchModelsAndCreds();
    return () => { isMounted = false; };
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeModel = models.find(m => m.id === selectedModelId) || {
    id: 'orbit-auto',
    name: 'Orbit Auto',
    provider: 'google',
    tier: 'pro',
    description: 'Dynamic model router',
  };

  const hasKeyForProvider = (provider: string) => {
    return credentials.some(c => c.provider === provider && c.status === 'valid');
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Model trigger pill */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200/80 bg-white/95 hover:bg-slate-50 text-slate-800 text-xs font-medium shadow-2xs transition-all cursor-pointer group"
      >
        <div className="w-2 h-2 rounded-full bg-linear-to-tr from-purple-500 to-indigo-500 animate-pulse" />
        
        <span className="font-semibold text-slate-900 tracking-tight">
          {activeStreamingModel ? `Orbit (${activeStreamingModel})` : activeModel.name}
        </span>

        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium uppercase tracking-wider ${
          selectedSource === 'byok'
            ? 'bg-amber-100/70 text-amber-800 border border-amber-200/60'
            : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
        }`}>
          {selectedSource === 'byok' ? 'BYOK' : 'Orbit'}
        </span>

        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 sm:left-0 mt-2 w-80 sm:w-88 rounded-2xl bg-white border border-slate-200/90 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header Source Switcher */}
          <div className="p-3 bg-slate-50/80 border-b border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Credential Source
              </span>
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenSettings();
                  }}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Settings2 className="w-3 h-3" />
                  Manage Keys
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/60 rounded-xl text-xs font-medium">
              <button
                type="button"
                onClick={() => onSelectSource('orbit')}
                className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  selectedSource === 'orbit'
                    ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                Orbit Managed
              </button>

              <button
                type="button"
                onClick={() => onSelectSource('byok')}
                className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  selectedSource === 'byok'
                    ? 'bg-white text-amber-800 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Key className="w-3.5 h-3.5 text-amber-600" />
                BYOK (Custom)
              </button>
            </div>
            
            <p className="mt-2 text-[11px] text-slate-500 leading-tight">
              {selectedSource === 'orbit'
                ? 'High-speed managed routing powered by Google Gemini & Orbit AI infrastructure.'
                : 'Direct inference with your personal API keys (OpenAI, Anthropic, xAI, Google).'}
            </p>
          </div>

          {/* Model List */}
          <div className="p-2 max-h-72 overflow-y-auto space-y-1">
            <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Available Models
            </div>

            {models.map((model) => {
              const isSelected = model.id === selectedModelId;
              const hasKey = hasKeyForProvider(model.provider);
              const isCompatibleWithSource = selectedSource === 'orbit' 
                ? model.isOrbitSupported 
                : true;

              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    onSelectModel(model.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl flex items-start justify-between gap-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/80 text-indigo-950 border border-indigo-200/70'
                      : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {model.id === 'orbit-auto' ? (
                        <Sparkles className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                      ) : (
                        <Cpu className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      )}
                      <span className="font-semibold text-xs truncate">
                        {model.name}
                      </span>
                      
                      {model.tier === 'fast' && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5" /> Fast
                        </span>
                      )}
                      {model.tier === 'pro' && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 font-semibold">
                          Pro
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 leading-snug">
                      {model.description}
                    </p>

                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                      <span>{model.provider.toUpperCase()}</span>
                      <span>•</span>
                      <span>{Math.round(model.contextWindow / 1000)}k ctx</span>
                      {selectedSource === 'byok' && (
                        <>
                          <span>•</span>
                          <span className={hasKey ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>
                            {hasKey ? 'Key ready' : 'No key'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
