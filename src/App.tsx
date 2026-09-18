import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { LoginPage } from './components/auth/LoginPage.tsx';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow.tsx';
import { AppSidebar } from './components/shell/AppSidebar.tsx';
import { ChatView } from './components/chat/ChatView.tsx';
import { ScheduledTasksView } from './components/tasks/ScheduledTasksView.tsx';
import { AgentsView } from './components/agents/AgentsView.tsx';
import { SettingsView } from './components/settings/SettingsView.tsx';
import { api } from './services/api.ts';
import { Loader2 } from 'lucide-react';
import type { Conversation } from './types/index.ts';

const AppContent: React.FC = () => {
  const { user, loading, refreshUser } = useAuth();
  const [currentView, setCurrentView] = useState<'chat' | 'scheduled_tasks' | 'agents' | 'settings'>('chat');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Load conversations when authenticated
  useEffect(() => {
    if (user && user.onboardingCompleted) {
      api.getConversations().then(res => {
        if (res.conversations) {
          setConversations(res.conversations);
          if (res.conversations.length > 0 && !activeConversationId) {
            setActiveConversationId(res.conversations[0].id);
          }
        }
      });
    }
  }, [user]);

  // Loading spinner while checking session
  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-white text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        <span className="text-xs font-semibold tracking-wider uppercase text-slate-500">Loading Orbit AI...</span>
      </div>
    );
  }

  // Not logged in -> Show Login Page
  if (!user) {
    return <LoginPage onSuccess={() => refreshUser()} />;
  }

  // Logged in but onboarding not completed -> Show Onboarding Flow
  if (!user.onboardingCompleted) {
    return <OnboardingFlow onComplete={() => refreshUser()} />;
  }

  // Main Workspace
  const handleNewChat = () => {
    setActiveConversationId(null);
    setCurrentView('chat');
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setCurrentView('chat');
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.deleteConversation(id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversationId === id) {
      setActiveConversationId(null);
    }
  };

  const handleNewConversationCreated = (newId: string) => {
    setActiveConversationId(newId);
    api.getConversations().then(res => {
      if (res.conversations) setConversations(res.conversations);
    });
  };

  const handleLaunchAgentInChat = async (prompt: string) => {
    // Create new chat with agent prompt
    const res = await api.createConversation('Agent Discussion');
    const newId = res.conversation.id;
    setActiveConversationId(newId);
    setCurrentView('chat');
    api.getConversations().then(r => r.conversations && setConversations(r.conversations));
  };

  const handleRunScheduledTaskInChat = async (prompt: string) => {
    const res = await api.createConversation('Automated Workflow Execution');
    const newId = res.conversation.id;
    setActiveConversationId(newId);
    setCurrentView('chat');
    api.getConversations().then(r => r.conversations && setConversations(r.conversations));
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-slate-900 font-sans">
      {/* Sidebar */}
      <AppSidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main View Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {currentView === 'chat' && (
          <ChatView
            conversationId={activeConversationId}
            onNewConversationCreated={handleNewConversationCreated}
            onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
          />
        )}

        {currentView === 'scheduled_tasks' && (
          <ScheduledTasksView onRunInChat={handleRunScheduledTaskInChat} />
        )}

        {currentView === 'agents' && (
          <AgentsView onStartAgentChat={handleLaunchAgentInChat} />
        )}

        {currentView === 'settings' && (
          <SettingsView />
        )}
      </main>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
