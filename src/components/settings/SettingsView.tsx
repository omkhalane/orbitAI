import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { requestGoogleSignIn, getStoredGoogleToken, storeGoogleToken } from '../../services/googleAuth.ts';
import { AiProvidersSettings } from './AiProvidersSettings.tsx';
import { AiUsageSettings } from './AiUsageSettings.tsx';
import { 
  Settings, 
  User, 
  Layers, 
  Brain, 
  Sliders, 
  Trash2, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Mail, 
  Calendar, 
  HardDrive, 
  FileText,
  Table,
  Presentation,
  CheckSquare, 
  MessageSquare,
  ClipboardList,
  StickyNote,
  Video,
  Users,
  FolderSearch,
  GraduationCap,
  Flame,
  Database,
  MapPin,
  Key,
  ShieldCheck,
  ExternalLink,
  Loader2,
  X,
  Sparkles,
  BarChart3
} from 'lucide-react';
import type { Integration, MemoryItem, UserSettings, IntegrationService } from '../../types/index.ts';

export const SettingsView: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'account' | 'apps' | 'ai_keys' | 'usage' | 'memory' | 'ai' | 'oauth'>('account');

  // Account form
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [callName, setCallName] = useState(user?.callName || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountSuccess, setAccountSuccess] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Apps
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [syncingService, setSyncingService] = useState<string | null>(null);
  const [connectingService, setConnectingService] = useState<string | null>(null);

  // Memories
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [newMemory, setNewMemory] = useState('');
  const [memoryError, setMemoryError] = useState<string | null>(null);

  // AI Settings
  const [aiSettings, setAiSettings] = useState<UserSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Manual OAuth Configuration Modal / Tab State
  const [manualClientId, setManualClientId] = useState('609252170522-oj81p9sduooi7fad8o716f3v4d01hvc2.apps.googleusercontent.com');
  const [manualClientSecret, setManualClientSecret] = useState('');
  const [manualCustomToken, setManualCustomToken] = useState(getStoredGoogleToken() || '');
  const [manualOAuthSaved, setManualOAuthSaved] = useState(false);
  const [manualOAuthError, setManualOAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setCallName(user.callName || '');
      setAvatar(user.avatar || '');
    }
  }, [user]);

  useEffect(() => {
    api.getIntegrations().then(res => res.integrations && setIntegrations(res.integrations));
    api.getMemories().then(res => res.memories && setMemories(res.memories));
    api.getSettings().then(res => res.settings && setAiSettings(res.settings));

    const handleCustomNav = (e: any) => {
      if (e.detail?.tab) {
        setActiveTab(e.detail.tab);
      }
    };
    window.addEventListener('orbit:navigate_settings', handleCustomNav);
    return () => window.removeEventListener('orbit:navigate_settings', handleCustomNav);
  }, []);

  // Strict Account Validation
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError(null);

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanCall = callName.trim();

    if (!cleanFirst) {
      setAccountError('First name cannot be empty.');
      return;
    }
    if (cleanFirst.length > 50 || cleanLast.length > 50 || cleanCall.length > 50) {
      setAccountError('Names must not exceed 50 characters.');
      return;
    }

    setSavingAccount(true);
    try {
      await api.updateProfile({ 
        firstName: cleanFirst, 
        lastName: cleanLast, 
        callName: cleanCall || cleanFirst, 
        avatar 
      });
      await refreshUser();
      setAccountSuccess(true);
      setTimeout(() => setAccountSuccess(false), 2500);
    } catch (err: any) {
      setAccountError(err.message || 'Failed to update profile.');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleSyncApp = async (service: string) => {
    setSyncingService(service);
    try {
      const res = await api.syncIntegration(service);
      if (res.success) {
        setIntegrations(prev => prev.map(i => i.service === service ? { ...i, lastSynced: res.lastSynced } : i));
      }
    } finally {
      setSyncingService(null);
    }
  };

  const handleDisconnectApp = async (service: string) => {
    await api.disconnectIntegration(service);
    setIntegrations(prev => prev.filter(i => i.service !== service));
  };

  const handleConnectApp = async (provider: string, service: IntegrationService, name: string) => {
    setConnectingService(service);
    try {
      let accountEmail = user?.email;
      if (provider === 'google') {
        const googleUser = await requestGoogleSignIn();
        if (googleUser?.email) {
          accountEmail = googleUser.email;
        }
      }

      const res = await api.connectIntegration({ 
        provider, 
        service, 
        name, 
        permissions: ['read', 'write', 'search', 'draft', 'execute'],
        accountEmail
      });

      if (res.success) {
        setIntegrations(prev => [...prev.filter(i => i.service !== service), res.integration]);
      }
    } catch (err) {
      console.error(`Failed to connect ${name}:`, err);
    } finally {
      setConnectingService(null);
    }
  };

  // Connect all Google Workspace apps at once
  const handleConnectAllGoogle = async () => {
    setConnectingService('all');
    try {
      const googleUser = await requestGoogleSignIn();
      const accountEmail = googleUser?.email || user?.email;

      const servicesToConnect: { service: IntegrationService; name: string }[] = [
        { service: 'gmail', name: 'Gmail' },
        { service: 'google_calendar', name: 'Google Calendar' },
        { service: 'google_drive', name: 'Google Drive' },
        { service: 'google_sheets', name: 'Google Sheets' },
        { service: 'google_docs', name: 'Google Docs' },
        { service: 'google_slides', name: 'Google Slides' },
        { service: 'google_tasks', name: 'Google Tasks' },
        { service: 'google_chat', name: 'Google Chat' },
        { service: 'google_forms', name: 'Google Forms' },
        { service: 'google_keep', name: 'Google Keep' },
        { service: 'google_meet', name: 'Google Meet' },
        { service: 'google_contacts', name: 'Google Contacts' },
        { service: 'google_picker', name: 'Google Picker' },
        { service: 'google_classroom', name: 'Google Classroom' },
        { service: 'google_maps', name: 'Google Maps Platform' },
        { service: 'firebase_firestore', name: 'Firebase Firestore & Auth' },
        { service: 'cloud_sql', name: 'Cloud SQL (PostgreSQL)' },
      ];

      for (const item of servicesToConnect) {
        await api.connectIntegration({
          provider: item.service.startsWith('firebase') ? 'firebase' : item.service.startsWith('cloud') ? 'cloudsql' : 'google',
          service: item.service,
          name: item.name,
          permissions: ['read', 'write', 'search', 'draft', 'execute'],
          accountEmail
        });
      }

      const refreshed = await api.getIntegrations();
      if (refreshed.integrations) {
        setIntegrations(refreshed.integrations);
      }
    } catch (err) {
      console.error('Failed to batch connect all Google services:', err);
    } finally {
      setConnectingService(null);
    }
  };

  // Strict Memory Validation
  const handleAddMemory = async () => {
    setMemoryError(null);
    const cleanMem = newMemory.trim();
    if (!cleanMem) {
      setMemoryError('Please enter a memory or preference statement.');
      return;
    }
    if (cleanMem.length > 2000) {
      setMemoryError('Memory must be under 2,000 characters.');
      return;
    }

    const res = await api.addMemory(cleanMem, 'preference', 'user_created');
    if (res.success) {
      setMemories(prev => [res.memory, ...prev]);
      setNewMemory('');
    }
  };

  const handleDeleteMemory = async (id: string) => {
    await api.deleteMemory(id);
    setMemories(prev => prev.filter(m => m.id !== id));
  };

  const handleUpdateAiSettings = async (updates: Partial<UserSettings>) => {
    if (!aiSettings) return;
    setSavingSettings(true);
    try {
      const res = await api.updateSettings(updates);
      if (res.success) {
        setAiSettings(res.settings);
      }
    } finally {
      setSavingSettings(false);
    }
  };

  // Save manual OAuth configuration
  const handleSaveManualOAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setManualOAuthError(null);

    const cleanToken = manualCustomToken.trim();
    if (cleanToken) {
      storeGoogleToken(cleanToken);
    }
    setManualOAuthSaved(true);
    setTimeout(() => setManualOAuthSaved(false), 3000);
  };

  const allGoogleApps: { service: IntegrationService; name: string; icon: React.ReactNode; desc: string; category: string }[] = [
    { service: 'gmail', name: 'Gmail', icon: <Mail className="w-5 h-5 text-red-500" />, desc: 'Email search, thread analysis, drafts, and responses', category: 'Communication' },
    { service: 'google_calendar', name: 'Google Calendar', icon: <Calendar className="w-5 h-5 text-blue-500" />, desc: 'Schedule lookup, agenda synthesis, and meeting coordination', category: 'Scheduling' },
    { service: 'google_drive', name: 'Google Drive', icon: <HardDrive className="w-5 h-5 text-emerald-500" />, desc: 'Search and inspect files, documents, sheets, and slide decks', category: 'Storage' },
    { service: 'google_docs', name: 'Google Docs', icon: <FileText className="w-5 h-5 text-blue-600" />, desc: 'Document reading, writing, and structured content extraction', category: 'Documents' },
    { service: 'google_sheets', name: 'Google Sheets', icon: <Table className="w-5 h-5 text-emerald-600" />, desc: 'Read rows, metrics, update cells, and analyze tabular records', category: 'Data' },
    { service: 'google_slides', name: 'Google Slides', icon: <Presentation className="w-5 h-5 text-amber-500" />, desc: 'Presentation deck search and slide summary generation', category: 'Documents' },
    { service: 'google_tasks', name: 'Google Tasks', icon: <CheckSquare className="w-5 h-5 text-indigo-500" />, desc: 'Action item synchronization, reminders, and checklist completion', category: 'Tasks' },
    { service: 'google_chat', name: 'Google Chat', icon: <MessageSquare className="w-5 h-5 text-emerald-500" />, desc: 'Chat space channel search and message thread summarization', category: 'Communication' },
    { service: 'google_forms', name: 'Google Forms', icon: <ClipboardList className="w-5 h-5 text-purple-500" />, desc: 'Survey summaries and response trend metrics', category: 'Forms' },
    { service: 'google_keep', name: 'Google Keep', icon: <StickyNote className="w-5 h-5 text-amber-500" />, desc: 'Quick idea notes, pinned lists, and persistent thought archives', category: 'Notes' },
    { service: 'google_meet', name: 'Google Meet', icon: <Video className="w-5 h-5 text-emerald-600" />, desc: 'Instant video conference links and scheduled calls', category: 'Meetings' },
    { service: 'google_contacts', name: 'Google Contacts', icon: <Users className="w-5 h-5 text-blue-500" />, desc: 'Search phone numbers, emails, addresses, and organizations', category: 'People' },
    { service: 'google_picker', name: 'Google Picker', icon: <FolderSearch className="w-5 h-5 text-sky-500" />, desc: 'Interactive visual Drive document & file selector UI', category: 'Storage' },
    { service: 'google_classroom', name: 'Google Classroom', icon: <GraduationCap className="w-5 h-5 text-amber-600" />, desc: 'Courses, announcements, materials, and syllabus listings', category: 'Education' },
    { service: 'google_maps', name: 'Google Maps Platform', icon: <MapPin className="w-5 h-5 text-red-500" />, desc: 'Places, business ratings, routes, and transit directions', category: 'Maps & Geo' },
    { service: 'firebase_firestore', name: 'Firebase Firestore & Auth', icon: <Flame className="w-5 h-5 text-amber-500" />, desc: 'Cloud database persistence, document store, and user accounts', category: 'Cloud Infrastructure' },
    { service: 'cloud_sql', name: 'Cloud SQL (PostgreSQL)', icon: <Database className="w-5 h-5 text-indigo-600" />, desc: 'Relational database schema, relational queries, and analytics', category: 'Cloud Infrastructure' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-10 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="pb-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-purple-600" />
            Workspace Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure Google integrations, security permissions, persistent memory, and AI behavior.
          </p>
        </div>

        {/* Global Action to Connect All Google Integrations */}
        <button
          type="button"
          disabled={connectingService === 'all'}
          onClick={handleConnectAllGoogle}
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-60"
        >
          {connectingService === 'all' ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Enabling All Services...
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              Enable All Google Services (Full Access)
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mt-6 border-b border-slate-200 overflow-x-auto pb-px">
        {[
          { id: 'account', label: 'Account Profile', icon: <User className="w-4 h-4" /> },
          { id: 'apps', label: 'Google & Workspace Apps', icon: <Layers className="w-4 h-4" /> },
          { id: 'ai_keys', label: 'AI Providers & BYOK', icon: <Sparkles className="w-4 h-4" /> },
          { id: 'usage', label: 'AI Usage & Quota', icon: <BarChart3 className="w-4 h-4" /> },
          { id: 'memory', label: 'Memory Vault', icon: <Brain className="w-4 h-4" /> },
          { id: 'ai', label: 'Behavior & Tone', icon: <Sliders className="w-4 h-4" /> },
          { id: 'oauth', label: 'Workspace OAuth Keys', icon: <Key className="w-4 h-4" /> },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div className="mt-6">
        {/* ACCOUNT TAB */}
        {activeTab === 'account' && (
          <form onSubmit={handleSaveAccount} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 max-w-2xl">
            <h3 className="text-base font-bold text-slate-900">User Profile & Identity</h3>

            {accountSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Profile updated successfully!</span>
              </div>
            )}

            {accountError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-800 border border-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span>{accountError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Call Name</label>
              <input
                type="text"
                value={callName}
                onChange={(e) => setCallName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-purple-500"
              />
              <p className="mt-1 text-xs text-slate-400">The nickname Orbit uses when speaking to you.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500 cursor-not-allowed"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingAccount}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {savingAccount && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        )}

        {/* GOOGLE & WORKSPACE APPS TAB */}
        {activeTab === 'apps' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-100 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider">Full Permissions & OAuth 2.0 Security</h4>
                  <p className="text-xs text-purple-900/80 mt-0.5 leading-relaxed">
                    Orbit requests comprehensive permissions across your Google Workspace to read spreadsheets, coordinate calendar events, triage emails, sync slide decks, search contacts, and launch Meet sessions. Actions that send emails or delete files require your explicit confirmation.
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100/70 px-3 py-1 rounded-full whitespace-nowrap">
                {integrations.filter(i => i.status === 'connected').length} of {allGoogleApps.length} Connected
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {allGoogleApps.map(app => {
                const isConnected = integrations.some(i => i.service === app.service);
                const intData = integrations.find(i => i.service === app.service);
                const isConnecting = connectingService === app.service;

                return (
                  <div 
                    key={app.service} 
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                      isConnected 
                        ? 'border-emerald-200 bg-emerald-50/20 shadow-2xs' 
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
                            {app.icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-slate-900">{app.name}</h4>
                              {isConnected && (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                                  Active ✓
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                              {app.category}
                            </span>
                          </div>
                        </div>

                        {isConnected ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleSyncApp(app.service)}
                              disabled={syncingService === app.service}
                              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                              title="Sync latest data"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${syncingService === app.service ? 'animate-spin text-purple-600' : ''}`} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDisconnectApp(app.service)}
                              className="text-[11px] text-red-500 hover:text-red-700 font-semibold px-2 py-1 cursor-pointer"
                            >
                              Disconnect
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isConnecting}
                            onClick={() => handleConnectApp('google', app.service, app.name)}
                            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {isConnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Connect'}
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                        {app.desc}
                      </p>
                    </div>

                    {isConnected && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100/80 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Permissions: Read, Search, Draft</span>
                        {intData?.lastSynced && (
                          <span>Synced {new Date(intData.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI PROVIDERS & BYOK TAB */}
        {activeTab === 'ai_keys' && (
          <AiProvidersSettings />
        )}

        {/* AI USAGE & QUOTA TAB */}
        {activeTab === 'usage' && (
          <AiUsageSettings />
        )}

        {/* MANUAL OAUTH TAB */}
        {activeTab === 'oauth' && (
          <form onSubmit={handleSaveManualOAuth} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5 max-w-3xl">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Key className="w-5 h-5 text-purple-600" />
                Manual OAuth Credentials & Custom Access Tokens
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Connect your custom Google Cloud Platform OAuth client credentials or inject your OAuth access token directly for high-security environments.
              </p>
            </div>

            {manualOAuthSaved && (
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>OAuth credentials and access tokens successfully applied!</span>
              </div>
            )}

            {manualOAuthError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-800 border border-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span>{manualOAuthError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Google Client ID
                </label>
                <input
                  type="text"
                  value={manualClientId}
                  onChange={(e) => setManualClientId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-purple-500"
                  placeholder="e.g. 609252170522-xxx.apps.googleusercontent.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Custom Google Access Token (Bearer)
                </label>
                <input
                  type="password"
                  value={manualCustomToken}
                  onChange={(e) => setManualCustomToken(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-purple-500"
                  placeholder="Paste Bearer token (ya29.a0...)"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Allows direct authorization without browser popup if you are using an existing GCP access token.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800">Approved OAuth Scopes:</div>
                <div className="text-[11px] font-mono text-slate-500 break-all leading-normal">
                  https://www.googleapis.com/auth/drive, https://www.googleapis.com/auth/spreadsheets, https://www.googleapis.com/auth/gmail.modify, https://www.googleapis.com/auth/calendar, https://www.googleapis.com/auth/documents, https://www.googleapis.com/auth/presentations, https://www.googleapis.com/auth/tasks, https://www.googleapis.com/auth/contacts, https://www.googleapis.com/auth/meetings.space.readonly
                </div>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                onClick={async () => {
                  const prof = await requestGoogleSignIn();
                  if (prof.accessToken) {
                    setManualCustomToken(prof.accessToken);
                    setManualOAuthSaved(true);
                    setTimeout(() => setManualOAuthSaved(false), 2500);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-all"
              >
                Re-authenticate via Google Pop-up
              </button>

              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold cursor-pointer transition-all shadow-xs"
              >
                Save OAuth Settings
              </button>
            </div>
          </form>
        )}

        {/* MEMORY VAULT TAB */}
        {activeTab === 'memory' && (
          <div className="space-y-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Add Knowledge or Personal Constraint
              </label>

              {memoryError && (
                <div className="p-2.5 rounded-lg bg-red-50 text-red-700 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  <span>{memoryError}</span>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMemory}
                  onChange={(e) => setNewMemory(e.target.value)}
                  placeholder="e.g. Always format executive summaries in bullet points with quantifiable metrics"
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={handleAddMemory}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Save Fact
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Stored Memories ({memories.length})</h4>
              {memories.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400 bg-white rounded-2xl border border-slate-200">
                  No memories recorded yet. Tell Orbit your preferences!
                </div>
              ) : (
                memories.map(mem => (
                  <div key={mem.id} className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs text-slate-700">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                      <span>{mem.content}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                        {mem.type}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteMemory(mem.id)}
                      className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* AI SETTINGS TAB */}
        {activeTab === 'ai' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6 max-w-2xl">
            <h3 className="text-base font-bold text-slate-900">Gemini AI Model & Behavior</h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Active AI Model</label>
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">Gemini 2.5 Flash</div>
                  <div className="text-slate-500">Sub-second multi-tool streaming, real-time Google Workspace coordination</div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 text-[11px] font-bold">
                  Primary Engine
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Response Tone & Style</label>
              <select
                value={aiSettings?.responsePreferences || 'Concise, clear, and proactive with actionable next steps.'}
                onChange={(e) => handleUpdateAiSettings({ responsePreferences: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-purple-500"
              >
                <option value="Concise, clear, and proactive with actionable next steps.">Concise & Action-Oriented (Default)</option>
                <option value="Executive summary with strategic bullet points and data tables.">Executive & Analytical</option>
                <option value="Comprehensive, step-by-step explanatory guidance.">Detailed & Instructional</option>
              </select>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Auto-Generate Conversation Titles</h4>
                <p className="text-xs text-slate-400">Intelligently name new chats based on the opening query</p>
              </div>
              <input
                type="checkbox"
                checked={aiSettings?.autoTitleEnabled ?? true}
                onChange={(e) => handleUpdateAiSettings({ autoTitleEnabled: e.target.checked })}
                className="w-4 h-4 text-purple-600 rounded cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
