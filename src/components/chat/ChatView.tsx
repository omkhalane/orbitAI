import React, { useState, useEffect, useRef } from 'react';
import { OrbitLogo } from '../common/OrbitLogo.tsx';
import { MessageItem } from './MessageItem.tsx';
import { ChatComposer } from './ChatComposer.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { 
  Sparkles, 
  Mail, 
  Calendar, 
  HardDrive, 
  CheckSquare, 
  PanelLeft, 
  Share2, 
  Info,
  Loader2,
  Check
} from 'lucide-react';
import type { ChatMessage, MessageAttachment, Integration } from '../../types/index.ts';

interface ChatViewProps {
  conversationId: string | null;
  onNewConversationCreated: (newId: string) => void;
  onSidebarToggle: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  conversationId,
  onNewConversationCreated,
  onSidebarToggle,
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load active integrations
  useEffect(() => {
    api.getIntegrations().then(res => {
      if (res.integrations) {
        setIntegrations(res.integrations.filter(i => i.status === 'connected'));
      }
    });
  }, []);

  // Load conversation messages
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    setLoading(true);
    api.getConversation(conversationId).then(res => {
      if (res.messages) {
        setMessages(res.messages);
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, [conversationId]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Suggested Prompts
  const suggestedPrompts = [
    {
      title: 'Triage Unread Emails',
      desc: 'What emails need my urgent attention from Sarah or the team?',
      icon: <Mail className="w-4 h-4 text-red-500" />,
    },
    {
      title: "Today's Schedule & Meetings",
      desc: 'Show me my schedule for today and highlight conflicts.',
      icon: <Calendar className="w-4 h-4 text-blue-500" />,
    },
    {
      title: 'Find Product Documents',
      desc: 'Search Drive for the Q3 Product Strategy and roadmap deck.',
      icon: <HardDrive className="w-4 h-4 text-emerald-500" />,
    },
    {
      title: 'Create Priority Task',
      desc: 'Add a task to finalize partnership review tomorrow at 10 AM.',
      icon: <CheckSquare className="w-4 h-4 text-indigo-500" />,
    },
  ];

  // Send message and stream response via SSE
  const handleSendMessage = async (text: string, attachments: MessageAttachment[]) => {
    let currentConvId = conversationId;

    // Create a new conversation if none exists
    if (!currentConvId) {
      try {
        const convRes = await api.createConversation('New Chat');
        currentConvId = convRes.conversation.id;
        onNewConversationCreated(currentConvId);
      } catch (err) {
        console.error('Failed to create conversation:', err);
        return;
      }
    }

    // Add user message to UI immediately
    const userMessage: ChatMessage = {
      id: `temp_user_${Date.now()}`,
      conversationId: currentConvId,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      attachments,
    };
    setMessages(prev => [...prev, userMessage]);

    // Setup streaming placeholder
    const tempAssistantId = `temp_asst_${Date.now()}`;
    const initialAssistantMsg: ChatMessage = {
      id: tempAssistantId,
      conversationId: currentConvId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      toolCalls: [],
    };
    setMessages(prev => [...prev, initialAssistantMsg]);
    setIsStreaming(true);

    try {
      const token = localStorage.getItem('orbit_token');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          conversationId: currentConvId,
          message: text,
          attachments,
        }),
      });

      if (!response.ok) {
        throw new Error('Streaming connection failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) return;

      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));

              if (data.type === 'text' && data.content) {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === tempAssistantId
                      ? { ...m, content: m.content + data.content }
                      : m
                  )
                );
              } else if (data.type === 'tool_call') {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === tempAssistantId
                      ? {
                          ...m,
                          toolCalls: [...(m.toolCalls || []), data.payload],
                        }
                      : m
                  )
                );
              } else if (data.type === 'tool_result') {
                setMessages(prev =>
                  prev.map(m => {
                    if (m.id !== tempAssistantId) return m;
                    const calls = [...(m.toolCalls || [])];
                    const target = calls.find(c => c.name === data.payload.name);
                    if (target) {
                      target.result = data.payload.result;
                      target.status = data.payload.requiresConfirmation ? 'pending' : 'executed';
                      target.requiresConfirmation = data.payload.requiresConfirmation;
                    }
                    return { ...m, toolCalls: calls };
                  })
                );
              } else if (data.type === 'error') {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === tempAssistantId
                      ? { ...m, content: m.content + `\n\n*(Error: ${data.error})*` }
                      : m
                  )
                );
              }
            } catch (parseErr) {
              console.warn('Could not parse SSE chunk:', parseErr);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Error during streaming:', err);
      setMessages(prev =>
        prev.map(m =>
          m.id === tempAssistantId
            ? { ...m, content: m.content || 'Orbit AI encountered an issue processing your request. Please try again.' }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  // Tool Confirmation handler
  const handleConfirmToolAction = async (toolName: string, args: Record<string, any>) => {
    const res = await api.confirmToolAction(toolName, args);
    if (res.success) {
      // Re-trigger assistant follow-up
      handleSendMessage(`I confirmed the ${toolName} action. Please proceed.`, []);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-white via-[#faf7f9]/60 to-white overflow-hidden">
      {/* Chat Header Bar */}
      <div className="px-4 py-3 border-b border-slate-100 bg-white/70 backdrop-blur-md flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSidebarToggle}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 cursor-pointer"
            title="Toggle sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900">Orbit Assistant</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
        </div>

        {/* Connected Apps Status Bar */}
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-medium">Connected tools:</span>
          {integrations.length === 0 ? (
            <span className="text-[11px] text-slate-400 italic">None active</span>
          ) : (
            <div className="flex items-center gap-1.5">
              {integrations.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold"
                >
                  <Check className="w-2.5 h-2.5 text-emerald-600" />
                  {item.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
            <span>Loading conversation...</span>
          </div>
        ) : messages.length === 0 ? (
          /* Empty State: Centered Greeting & Prompts */
          <div className="min-h-full max-w-2xl mx-auto px-6 py-12 flex flex-col items-center justify-center text-center">
            <div className="mb-4">
              <OrbitLogo size="xl" glow={true} />
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.callName || user?.firstName || 'there'}!
            </h1>
            <p className="mt-2 text-sm text-slate-500 max-w-md leading-relaxed">
              How can Orbit assist you today? Ask anything about your connected emails, calendar events, documents, or tasks.
            </p>

            {/* Smart Contextual Prompts */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
              {suggestedPrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(p.desc, [])}
                  className="p-4 rounded-xl border border-slate-200/80 bg-white hover:border-purple-300 hover:shadow-xs transition-all flex flex-col justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {p.icon}
                    <span className="text-xs font-bold text-slate-800 group-hover:text-purple-600 transition-colors">
                      {p.title}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-snug">
                    {p.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Render Active Message Stream */
          <div className="max-w-4xl mx-auto py-4">
            {messages.map((msg) => (
              <MessageItem
                key={msg.id}
                message={msg}
                onConfirmToolAction={handleConfirmToolAction}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Bottom Chat Composer */}
      <div className="w-full">
        <ChatComposer
          onSendMessage={handleSendMessage}
          isStreaming={isStreaming}
        />
      </div>
    </div>
  );
};
