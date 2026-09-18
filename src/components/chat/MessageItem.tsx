import React, { useState } from 'react';
import Markdown from 'react-markdown';
import { OrbitLogo } from '../common/OrbitLogo.tsx';
import { ToolCallCard } from './ToolCallCard.tsx';
import { Copy, Check, Volume2, FileText, Download } from 'lucide-react';
import type { ChatMessage } from '../../types/index.ts';

interface MessageItemProps {
  message: ChatMessage;
  onConfirmToolAction?: (toolName: string, args: Record<string, any>) => Promise<void>;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, onConfirmToolAction }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    if (!window.speechSynthesis) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(message.content);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className={`py-4 px-4 sm:px-6 flex gap-3.5 transition-colors ${
      isUser ? 'justify-end' : 'justify-start bg-[#faf8fa]/40 border-y border-slate-50'
    }`}>
      {/* Assistant Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-8 h-8 rounded-xl bg-white border border-purple-100 shadow-xs flex items-center justify-center">
            <OrbitLogo size="xs" glow={true} />
          </div>
        </div>
      )}

      {/* Message Body */}
      <div className={`flex flex-col ${isUser ? 'items-end max-w-2xl' : 'items-start max-w-3xl flex-1'}`}>
        {/* User Attached files chips */}
        {isUser && message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {message.attachments.map((att, idx) => (
              <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium">
                <FileText className="w-3.5 h-3.5 text-purple-600" />
                <span className="truncate max-w-[180px]">{att.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Message Content Container */}
        <div className={`text-sm leading-relaxed ${
          isUser
            ? 'px-4 py-2.5 rounded-2xl rounded-tr-xs bg-slate-900 text-white font-medium shadow-xs'
            : 'text-slate-800 w-full'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="space-y-3">
              {/* Tool Calls */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="space-y-2 mb-2">
                  {message.toolCalls.map((tc, idx) => (
                    <ToolCallCard
                      key={idx}
                      toolCall={tc}
                      onConfirmAction={onConfirmToolAction}
                    />
                  ))}
                </div>
              )}

              {/* Markdown Assistant Content */}
              {message.content && (
                <div className="markdown-body prose prose-sm max-w-none prose-slate prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-slate-900 prose-a:text-purple-600 prose-a:underline prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-xs">
                  <Markdown>{message.content}</Markdown>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Message Action Bar (Assistant Only) */}
        {!isUser && message.content && (
          <div className="mt-2 flex items-center gap-2 text-slate-400 text-xs">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
              title="Copy message"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {typeof window !== 'undefined' && 'speechSynthesis' in window && (
              <button
                type="button"
                onClick={handleSpeak}
                className={`inline-flex items-center gap-1 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer ${
                  isSpeaking ? 'text-purple-600 font-semibold' : ''
                }`}
                title="Read aloud"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{isSpeaking ? 'Stop' : 'Listen'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
