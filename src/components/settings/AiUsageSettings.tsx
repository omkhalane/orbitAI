import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Zap, 
  ShieldCheck, 
  Cpu, 
  Clock, 
  Loader2,
  TrendingUp,
  CreditCard
} from 'lucide-react';
import { api } from '../../services/api.ts';
import type { AiUsageRecord, AiEntitlement } from '../../types/index.ts';

export const AiUsageSettings: React.FC = () => {
  const [usage, setUsage] = useState<AiUsageRecord[]>([]);
  const [entitlement, setEntitlement] = useState<AiEntitlement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        setLoading(true);
        const res = await api.getAiUsage();
        if (res.usage) setUsage(res.usage);
        if (res.entitlement) setEntitlement(res.entitlement);
      } catch (err) {
        console.error('Failed to load AI usage:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsage();
  }, []);

  const totalInputTokens = usage.reduce((sum, u) => sum + (u.inputTokens || 0), 0);
  const totalOutputTokens = usage.reduce((sum, u) => sum + (u.outputTokens || 0), 0);
  const totalCost = usage.reduce((sum, u) => sum + (u.estimatedCost || 0), 0);

  const usagePercent = entitlement && entitlement.monthlyAiLimit > 0
    ? Math.min(100, Math.round((entitlement.currentUsageTokens / entitlement.monthlyAiLimit) * 100))
    : 0;

  return (
    <div className="space-y-6 max-w-3xl">
      {loading ? (
        <div className="p-12 flex items-center justify-center text-slate-400 text-xs gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
          <span>Loading AI usage metrics...</span>
        </div>
      ) : (
        <>
          {/* Entitlement Quota Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  {entitlement?.plan.replace('_', ' ').toUpperCase() || 'ORBIT PRO'}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">Monthly AI Token Allowance</h3>
                <p className="text-xs text-slate-500">Orbit-managed models token consumption for current billing cycle</p>
              </div>

              <div className="text-right sm:text-right">
                <span className="text-xl font-extrabold text-slate-900">
                  {((entitlement?.currentUsageTokens || 0) / 1000).toFixed(1)}k
                </span>
                <span className="text-xs text-slate-400"> / {((entitlement?.monthlyAiLimit || 2_000_000) / 1000).toFixed(0)}k tokens</span>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 rounded-full ${
                    usagePercent > 85 ? 'bg-amber-500' : 'bg-linear-to-r from-purple-500 to-indigo-600'
                  }`}
                  style={{ width: `${Math.max(4, usagePercent)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                <span>{usagePercent}% utilized</span>
                <span>{((entitlement?.remainingTokens || 0) / 1000).toFixed(1)}k tokens remaining</span>
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center gap-2 text-slate-500 text-xs">
                <Cpu className="w-4 h-4 text-purple-600" />
                <span>Total Inference Turns</span>
              </div>
              <div className="text-xl font-bold text-slate-900 mt-2">{usage.length}</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center gap-2 text-slate-500 text-xs">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Total Tokens Processed</span>
              </div>
              <div className="text-xl font-bold text-slate-900 mt-2">
                {((totalInputTokens + totalOutputTokens) / 1000).toFixed(1)}k
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center gap-2 text-slate-500 text-xs">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>Estimated Value (USD)</span>
              </div>
              <div className="text-xl font-bold text-slate-900 mt-2">${totalCost.toFixed(4)}</div>
            </div>
          </div>

          {/* Recent Usage Records Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                Recent AI Model Invocations
              </h4>
              <span className="text-[11px] text-slate-400">Tracked via Vercel AI SDK 7</span>
            </div>

            {usage.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No AI model calls recorded yet. Start chatting with Orbit to view live telemetry!
              </div>
            ) : (
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="py-2.5 px-4">Time</th>
                      <th className="py-2.5 px-3">Model</th>
                      <th className="py-2.5 px-3">Tier / Source</th>
                      <th className="py-2.5 px-3 text-right">In Tokens</th>
                      <th className="py-2.5 px-3 text-right">Out Tokens</th>
                      <th className="py-2.5 px-4 text-right">Est. Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px] text-slate-700">
                    {usage.slice(0, 25).map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                          {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {record.modelId}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                            record.credentialSource === 'byok'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            {record.credentialSource}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">{record.inputTokens}</td>
                        <td className="py-2.5 px-3 text-right">{record.outputTokens}</td>
                        <td className="py-2.5 px-4 text-right text-emerald-700 font-medium">
                          ${record.estimatedCost.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
