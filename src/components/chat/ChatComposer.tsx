import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowUp, 
  Paperclip, 
  Mic, 
  MicOff, 
  X, 
  FileText, 
  Loader2,
  Sparkles
} from 'lucide-react';
import { api } from '../../services/api.ts';
import type { MessageAttachment } from '../../types/index.ts';

interface ChatComposerProps {
  onSendMessage: (message: string, attachments: MessageAttachment[]) => void;
  disabled?: boolean;
  isStreaming?: boolean;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  onSendMessage,
  disabled = false,
  isStreaming = false,
}) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [text]);

  // Voice speech-to-text initialization
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recog = new SpeechRecognition();
      recog.continuous = false;
      recog.interimResults = true;
      recog.lang = 'en-US';

      recog.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setText(prev => (prev ? `${prev} ${transcript}` : transcript));
      };

      recog.onerror = () => setIsRecording(false);
      recog.onend = () => setIsRecording(false);

      recognitionRef.current = recog;
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Voice recognition is not supported in this browser.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const res = await api.uploadFile(file);
      if (res.success && res.attachment) {
        setAttachments(prev => [...prev, res.attachment]);
      }
    } catch (err) {
      console.error('File upload error:', err);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!text.trim() && attachments.length === 0) || disabled || isStreaming) return;

    onSendMessage(text.trim(), attachments);
    setText('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4">
      <div className="relative rounded-2xl border border-slate-200/90 bg-white shadow-sm transition-all focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-400/20">
        {/* Attachment chips */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 border-b border-slate-100">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-medium"
              >
                <FileText className="w-3.5 h-3.5 text-purple-600" />
                <span className="truncate max-w-[180px]">{att.name}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(att.id)}
                  className="p-0.5 text-slate-400 hover:text-red-500 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? 'Listening...' : 'Ask Orbit anything about your work, calendar, files, or tasks...'}
          disabled={disabled || isStreaming}
          className="w-full px-4 pt-3 pb-2 text-sm text-slate-800 placeholder-slate-400 bg-transparent resize-none focus:outline-none max-h-[180px]"
        />

        {/* Controls Bar */}
        <div className="px-3 pb-2.5 pt-1 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {/* File Upload Button */}
            <label className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer relative">
              <input
                type="file"
                className="sr-only"
                onChange={handleFileUpload}
                disabled={isUploading || isStreaming}
                accept=".pdf,.txt,.md,.csv,.json,.doc,.docx"
              />
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
              ) : (
                <Paperclip className="w-4 h-4" />
              )}
            </label>

            {/* Voice Input Button */}
            <button
              type="button"
              onClick={toggleRecording}
              disabled={isStreaming}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                isRecording
                  ? 'bg-red-50 text-red-600 animate-pulse'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              }`}
              title={isRecording ? 'Stop recording' : 'Voice input'}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-[11px] text-slate-400">
              Shift + Enter for new line
            </span>

            {/* Send Button */}
            <button
              id="send-message-button"
              type="button"
              onClick={() => handleSubmit()}
              disabled={(!text.trim() && attachments.length === 0) || isStreaming}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-30 disabled:hover:bg-slate-900 shadow-xs transition-all cursor-pointer"
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
