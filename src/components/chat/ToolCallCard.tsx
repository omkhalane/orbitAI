import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp, 
  Mail, 
  Calendar, 
  HardDrive, 
  CheckSquare, 
  Brain, 
  Send,
  Loader2
} from 'lucide-react';
import type { ToolCallPayload } from '../../types/index.ts';

interface ToolCallCardProps {
  toolCall: ToolCallPayload;
  onConfirmAction?: (toolName: string, args: Record<string, any>) => Promise<void>;
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({ toolCall, onConfirmAction }) => {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const getToolIcon = (name: string) => {
    if (name.includes('gmail') || name.includes('email')) return <Mail className="w-4 h-4 text-red-500" />;
    if (name.includes('calendar')) return <Calendar className="w-4 h-4 text-blue-500" />;
    if (name.includes('drive')) return <HardDrive className="w-4 h-4 text-emerald-500" />;
    if (name.includes('task')) return <CheckSquare className="w-4 h-4 text-indigo-500" />;
    if (name.includes('memory')) return <Brain className="w-4 h-4 text-purple-500" />;
    return <Clock className="w-4 h-4 text-slate-500" />;
  };

  const getToolHumanName = (name: string) => {
    switch (name) {
      case 'search_gmail': return 'Search Gmail Inbox';
      case 'get_email': return 'Read Email Message';
      case 'draft_email': return 'Create Email Draft';
      case 'send_email': return 'Send Outgoing Email';
      case 'search_calendar': return 'Check Calendar Schedule';
      case 'create_calendar_event': return 'Schedule Calendar Event';
      case 'search_drive': return 'Search Cloud Drive Files';
      case 'get_drive_file': return 'Retrieve Document';
      case 'create_task': return 'Create Action Item';
      case 'search_tasks': return 'Search Task List';
      case 'search_memory': return 'Query Orbit Memory';
      case 'save_memory': return 'Record User Preference';
      default: return name.replace(/_/g, ' ');
    }
  };

  const handleConfirm = async () => {
    if (!onConfirmAction) return;
    setConfirming(true);
    try {
      await onConfirmAction(toolCall.name, toolCall.arguments);
      setConfirmed(true);
    } catch (err) {
      console.error('Confirmation failed:', err);
    } finally {
      setConfirming(false);
    }
  };

  const isPendingConfirmation = toolCall.requiresConfirmation && !confirmed;

  return (
    <div className={`my-2 rounded-xl border text-xs overflow-hidden transition-all ${
      isPendingConfirmation 
        ? 'border-amber-200 bg-amber-50/40' 
        : 'border-slate-200/80 bg-white/90 shadow-xs'
    }`}>
      {/* Header bar */}
      <div 
        onClick={() => setExpanded(!expanded)}
        className="px-3.5 py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {getToolIcon(toolCall.name)}
          <span className="font-semibold text-slate-800">
            {getToolHumanName(toolCall.name)}
          </span>
          <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            {toolCall.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isPendingConfirmation ? (
            <span className="inline-flex items-center gap-1 font-semibold text-[10px] text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" />
              Confirmation Required
            </span>
          ) : toolCall.result ? (
            <span className="inline-flex items-center gap-1 font-semibold text-[10px] text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              Executed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              <Loader2 className="w-3 h-3 animate-spin" />
              Running...
            </span>
          )}

          <button type="button" className="text-slate-400 hover:text-slate-600">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Confirmation Action Box */}
      {isPendingConfirmation && (
        <div className="px-4 py-3 border-t border-amber-200/60 bg-white/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-slate-700">
            <p className="font-semibold text-slate-900">Do you want Orbit to execute this action?</p>
            <p className="text-[11px] text-slate-500">
              Target: <strong className="font-medium">{toolCall.arguments.to || 'External System'}</strong> — Subject: "{toolCall.arguments.subject || toolCall.arguments.title || 'Action'}"
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              disabled={confirming}
              onClick={handleConfirm}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {confirming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Confirm & Execute
            </button>
          </div>
        </div>
      )}

      {/* Expanded Technical Payload */}
      {expanded && (
        <div className="px-3.5 py-2.5 border-t border-slate-100 bg-slate-50/70 space-y-2">
          {toolCall.arguments && Object.keys(toolCall.arguments).length > 0 && (
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Arguments:</span>
              <pre className="mt-1 p-2 rounded-lg bg-white border border-slate-200 font-mono text-[11px] text-slate-700 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(toolCall.arguments, null, 2)}
              </pre>
            </div>
          )}

          {toolCall.result && (
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tool Result:</span>
              <pre className="mt-1 p-2 rounded-lg bg-white border border-slate-200 font-mono text-[11px] text-slate-700 overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
                {JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
