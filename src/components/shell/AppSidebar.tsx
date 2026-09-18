import React from 'react';
import { OrbitLogo } from '../common/OrbitLogo.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { 
  Plus, 
  MessageSquare, 
  Clock, 
  Bot, 
  Settings, 
  LogOut, 
  Trash2, 
  ChevronRight,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react';
import type { Conversation } from '../../types/index.ts';

interface AppSidebarProps {
  currentView: 'chat' | 'scheduled_tasks' | 'agents' | 'settings';
  setCurrentView: (view: 'chat' | 'scheduled_tasks' | 'agents' | 'settings') => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string, e: React.MouseEvent) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentView,
  setCurrentView,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  isOpen,
  onToggle,
}) => {
  const { user, logout } = useAuth();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-xs z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-[270px] bg-white border-r border-slate-100 flex flex-col justify-between transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden lg:border-r-0'
      }`}>
        {/* Top Header & Branding */}
        <div className="p-4 border-b border-slate-50 flex items-center justify-between">
          <div 
            onClick={() => { setCurrentView('chat'); onNewChat(); }}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            <OrbitLogo size="sm" glow={true} />
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1">
                Orbit <span className="text-purple-600 font-extrabold">AI</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide">Workspace</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggle}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 lg:hidden cursor-pointer"
            title="Close sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Primary Action: + New Chat */}
        <div className="p-3">
          <button
            id="new-chat-sidebar-btn"
            type="button"
            onClick={() => {
              setCurrentView('chat');
              onNewChat();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
          {/* Main Navigation */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setCurrentView('chat')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                currentView === 'chat'
                  ? 'bg-purple-50/80 text-purple-900 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <MessageSquare className={`w-4 h-4 ${currentView === 'chat' ? 'text-purple-600' : 'text-slate-400'}`} />
              <span>AI Chat</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentView('scheduled_tasks')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                currentView === 'scheduled_tasks'
                  ? 'bg-purple-50/80 text-purple-900 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Clock className={`w-4 h-4 ${currentView === 'scheduled_tasks' ? 'text-purple-600' : 'text-slate-400'}`} />
              <span>Scheduled Tasks</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentView('agents')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                currentView === 'agents'
                  ? 'bg-purple-50/80 text-purple-900 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Bot className={`w-4 h-4 ${currentView === 'agents' ? 'text-purple-600' : 'text-slate-400'}`} />
              <span>My Agents</span>
            </button>
          </div>

          {/* Recent Conversations */}
          <div>
            <div className="px-2 mb-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <span>Recent Chats</span>
              <span className="text-[10px] font-normal">{conversations.length}</span>
            </div>

            {conversations.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">
                No recent chats yet. Start a conversation!
              </div>
            ) : (
              <div className="space-y-0.5">
                {conversations.map((conv) => {
                  const isSelected = currentView === 'chat' && activeConversationId === conv.id;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => {
                        setCurrentView('chat');
                        onSelectConversation(conv.id);
                      }}
                      className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-100 text-slate-900 font-semibold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-6">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{conv.title}</span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => onDeleteConversation(conv.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded transition-opacity cursor-pointer"
                        title="Delete conversation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Bottom User Profile & Settings */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 truncate">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.callName || 'User'}
                  className="w-8 h-8 rounded-full border border-slate-200 object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                  {(user?.callName || user?.firstName || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className="truncate flex flex-col">
                <span className="text-xs font-semibold text-slate-900 truncate">
                  {user?.callName || user?.firstName} {user?.lastName || ''}
                </span>
                <span className="text-[10px] text-slate-400 truncate">
                  {user?.email}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => setCurrentView('settings')}
                className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer ${
                  currentView === 'settings' ? 'bg-purple-100 text-purple-700' : ''
                }`}
                title="Workspace Settings"
              >
                <Settings className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={logout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
