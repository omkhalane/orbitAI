import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import { 
  Bot, 
  Plus, 
  Trash2, 
  ArrowRight, 
  Mail, 
  Calendar, 
  HardDrive, 
  CheckSquare, 
  Sparkles,
  Loader2,
  X
} from 'lucide-react';
import type { SpecializedAgent } from '../../types/index.ts';

interface AgentsViewProps {
  onStartAgentChat: (agentPrompt: string) => void;
}

export const AgentsView: React.FC<AgentsViewProps> = ({ onStartAgentChat }) => {
  const [agents, setAgents] = useState<SpecializedAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [creating, setCreating] = useState(false);

  const loadAgents = async () => {
    try {
      const res = await api.getAgents();
      if (res.agents) {
        setAgents(res.agents);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !instructions.trim()) return;

    setCreating(true);
    try {
      const res = await api.createAgent({
        name: name.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        tools: ['search_gmail', 'search_calendar', 'search_drive', 'create_task'],
      });
      if (res.success && res.agent) {
        setAgents(prev => [...prev, res.agent]);
        setIsModalOpen(false);
        setName('');
        setDescription('');
        setInstructions('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteAgent(id);
      setAgents(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const getAgentIcon = (iconName: string) => {
    switch (iconName) {
      case 'Mail': return <Mail className="w-5 h-5 text-red-500" />;
      case 'Calendar': return <Calendar className="w-5 h-5 text-blue-500" />;
      case 'HardDrive': return <HardDrive className="w-5 h-5 text-emerald-500" />;
      default: return <Bot className="w-5 h-5 text-purple-600" />;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-10 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Bot className="w-6 h-6 text-purple-600" />
            Specialized Agents
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Preconfigured autonomous AI personas tuned with dedicated tools and system instructions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create New Agent
        </button>
      </div>

      {/* Agents Grid */}
      <div className="mt-8">
        {loading ? (
          <div className="py-12 flex justify-center items-center text-slate-400 text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
            <span>Loading agents...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="p-5 rounded-2xl border border-slate-200/90 bg-white shadow-xs hover:border-purple-300 hover:shadow-sm transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                      {getAgentIcon(agent.icon)}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(agent.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-600 rounded transition-opacity cursor-pointer"
                      title="Delete agent"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">{agent.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                    {agent.description}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {agent.tools.map((t, idx) => (
                      <span key={idx} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-50">
                  <button
                    type="button"
                    onClick={() => onStartAgentChat(`[Activating ${agent.name}]\nInstructions: ${agent.instructions}\nHello! How can you help me?`)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Launch in Chat</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Create Custom Agent</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Executive Gatekeeper"
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Filters external meeting requests and drafts diplomatic declines."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Autonomous Instructions & Directives
                </label>
                <textarea
                  rows={4}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Define how this agent should think, inspect emails, and coordinate schedules..."
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
