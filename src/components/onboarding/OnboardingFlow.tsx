import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { OrbitLogo } from '../common/OrbitLogo.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { requestGoogleSignIn } from '../../services/googleAuth.ts';
import { 
  User, 
  Layers, 
  Brain, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
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
  MapPin,
  Flame,
  Database,
  Cloud,
  Upload,
  Loader2,
  FileCheck,
  ShieldCheck,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import type { Integration, IntegrationService } from '../../types/index.ts';

interface OnboardingFlowProps {
  onComplete: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const { user, refreshUser } = useAuth();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Profile State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [callName, setCallName] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);

  // Step 2: Integrations State
  const [connectedServices, setConnectedServices] = useState<string[]>([]);
  const [connectingService, setConnectingService] = useState<string | null>(null);

  // Step 3: Memory State
  const [memoryText, setMemoryText] = useState('');
  const [savedMemories, setSavedMemories] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; status: 'uploading' | 'processing' | 'ready' }>>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Final Saving State
  const [finalizing, setFinalizing] = useState(false);

  // Initialize profile from authenticated user
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setCallName(user.callName || user.firstName || '');
    }
  }, [user]);

  // Load existing connected apps
  useEffect(() => {
    api.getIntegrations().then(res => {
      if (res.integrations) {
        setConnectedServices(res.integrations.map(i => i.service));
      }
    });
  }, []);

  // Handle Profile Save with strict validation
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanCall = callName.trim();

    if (!cleanFirst) {
      setProfileError('Please enter your first name.');
      return;
    }
    if (cleanFirst.length > 50 || cleanLast.length > 50 || cleanCall.length > 50) {
      setProfileError('Names must not exceed 50 characters.');
      return;
    }

    try {
      await api.updateProfile({
        firstName: cleanFirst,
        lastName: cleanLast,
        callName: cleanCall || cleanFirst,
      });
      await refreshUser();
      setCurrentStep(2);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile.');
    }
  };

  // Connect individual integration
  const handleConnectService = async (provider: string, service: string, name: string) => {
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
        setConnectedServices(prev => [...prev.filter(s => s !== service), service]);
      }
    } catch (e) {
      console.error('Failed to connect service:', e);
    } finally {
      setConnectingService(null);
    }
  };

  // Connect all Google services at once
  const handleConnectAllGoogle = async () => {
    setConnectingService('all');
    try {
      const googleUser = await requestGoogleSignIn();
      const accountEmail = googleUser?.email || user?.email;

      const services: { service: IntegrationService; name: string }[] = [
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

      for (const item of services) {
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
        setConnectedServices(refreshed.integrations.map(i => i.service));
      }
    } catch (err) {
      console.error('Failed to connect all services:', err);
    } finally {
      setConnectingService(null);
    }
  };

  // Disconnect service
  const handleDisconnectService = async (service: string) => {
    await api.disconnectIntegration(service);
    setConnectedServices(prev => prev.filter(s => s !== service));
  };

  // Save Text Memory
  const handleSaveMemory = async () => {
    if (!memoryText.trim()) return;
    try {
      await api.addMemory(memoryText.trim(), 'preference', 'user_created');
      setSavedMemories(prev => [...prev, memoryText.trim()]);
      setMemoryText('');
    } catch (e) {
      console.error('Error saving memory:', e);
    }
  };

  // Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const tempFile = { name: file.name, status: 'uploading' as const };
    setUploadedFiles(prev => [...prev, tempFile]);

    try {
      // Simulate brief upload progress then processing
      setTimeout(() => {
        setUploadedFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'processing' } : f));
      }, 600);

      const res = await api.uploadFile(file);
      if (res.success) {
        setUploadedFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'ready' } : f));
      }
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Finish Onboarding
  const handleCompleteOnboarding = async () => {
    setFinalizing(true);
    try {
      // Persist profile
      await api.updateProfile({
        firstName,
        lastName,
        callName: callName || firstName,
      });

      // Mark onboarding completed
      await api.completeOnboarding();
      await refreshUser();

      // Confetti effect
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#38bdf8', '#818cf8', '#c084fc', '#f472b6'],
      });

      setTimeout(() => {
        onComplete();
      }, 700);
    } catch (err) {
      console.error('Failed to finalize onboarding:', err);
    } finally {
      setFinalizing(false);
    }
  };

  const steps = [
    { num: 1, label: 'Profile', icon: <User className="w-4 h-4" /> },
    { num: 2, label: 'Connect Apps', icon: <Layers className="w-4 h-4" /> },
    { num: 3, label: 'Memory', icon: <Brain className="w-4 h-4" /> },
    { num: 4, label: 'Finish', icon: <Sparkles className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-white via-[#faf7f9] to-[#fffbfc] text-slate-800">
      {/* Top Header */}
      <header className="w-full border-b border-slate-100 bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <OrbitLogo size="sm" glow={true} />
          <span className="text-lg font-bold text-slate-900 tracking-tight">
            Orbit <span className="text-purple-600">AI</span> Setup
          </span>
        </div>

        {/* Stepper Progress */}
        <div className="hidden sm:flex items-center gap-2">
          {steps.map((s, idx) => {
            const isActive = currentStep === s.num;
            const isDone = currentStep > s.num;
            return (
              <React.Fragment key={s.num}>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  isActive 
                    ? 'bg-purple-100/80 text-purple-900 border border-purple-200' 
                    : isDone
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-400'
                }`}>
                  {isDone ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : s.icon}
                  <span>{s.label}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`w-6 h-0.5 rounded-full ${isDone ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Step {currentStep} of 4
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-6 sm:p-10 flex flex-col justify-center">
        {/* STEP 1: Profile */}
        {currentStep === 1 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Personalize your Orbit profile
            </h2>
            <p className="mt-1 text-sm text-slate-500 leading-relaxed">
              Orbit adapts its communication style and tone to your workflow preferences.
            </p>

            <form onSubmit={handleSaveProfile} className="mt-8 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first-name-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    First name
                  </label>
                  <input
                    id="first-name-input"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Alex"
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="last-name-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Last name
                  </label>
                  <input
                    id="last-name-input"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Smith"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="call-name-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  What should Orbit call you?
                </label>
                <input
                  id="call-name-input"
                  type="text"
                  value={callName}
                  onChange={(e) => setCallName(e.target.value)}
                  placeholder="Alex"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  Used in greeting messages, calendar invites, and daily executive briefings.
                </p>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  id="step1-continue-button"
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 2: Connect Apps */}
        {currentStep === 2 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Connect your productivity apps
                </h2>
                <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                  Connect your tools so Orbit can seamlessly coordinate your work and take action across your digital ecosystem.
                </p>
              </div>

              <button
                type="button"
                disabled={connectingService === 'all'}
                onClick={handleConnectAllGoogle}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-60 flex-shrink-0"
              >
                {connectingService === 'all' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Connecting All Services...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Connect All Google Services
                  </>
                )}
              </button>
            </div>

            {/* Google Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Google Workspace & Cloud</span>
                  <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-100">
                    Full Integration
                  </span>
                </div>
                <span className="text-xs font-medium text-slate-400">
                  {connectedServices.length} connected
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                {[
                  { service: 'gmail', name: 'Gmail', icon: <Mail className="w-4 h-4 text-red-500" />, desc: 'Email search, unread triage, drafts & responses' },
                  { service: 'google_calendar', name: 'Google Calendar', icon: <Calendar className="w-4 h-4 text-blue-500" />, desc: 'Schedule lookup, agenda sync, event booking' },
                  { service: 'google_drive', name: 'Google Drive', icon: <HardDrive className="w-4 h-4 text-emerald-500" />, desc: 'Cross-file search, PDFs, docs & presentations' },
                  { service: 'google_sheets', name: 'Google Sheets', icon: <Table className="w-4 h-4 text-emerald-600" />, desc: 'Read rows, metrics, update cells & spreadsheet data' },
                  { service: 'google_docs', name: 'Google Docs', icon: <FileText className="w-4 h-4 text-blue-600" />, desc: 'Read, write, edit, and search documents' },
                  { service: 'google_slides', name: 'Google Slides', icon: <Presentation className="w-4 h-4 text-amber-500" />, desc: 'Slide decks, slide summaries, and presentation search' },
                  { service: 'google_tasks', name: 'Google Tasks', icon: <CheckSquare className="w-4 h-4 text-indigo-500" />, desc: 'Sync action items, reminders, and checklists' },
                  { service: 'google_chat', name: 'Google Chat', icon: <MessageSquare className="w-4 h-4 text-emerald-500" />, desc: 'Read spaces and summarize chat conversations' },
                  { service: 'google_forms', name: 'Google Forms', icon: <ClipboardList className="w-4 h-4 text-purple-500" />, desc: 'Collect and analyze survey responses' },
                  { service: 'google_keep', name: 'Google Keep', icon: <StickyNote className="w-4 h-4 text-amber-500" />, desc: 'Organize ideas, quick notes, and memos' },
                  { service: 'google_meet', name: 'Google Meet', icon: <Video className="w-4 h-4 text-emerald-600" />, desc: 'Streamline video meetings and generate links' },
                  { service: 'google_contacts', name: 'Contacts', icon: <Users className="w-4 h-4 text-blue-500" />, desc: 'Sync and manage personal & professional contacts' },
                  { service: 'google_picker', name: 'Google Picker', icon: <FolderSearch className="w-4 h-4 text-sky-500" />, desc: 'Securely select Drive documents and media' },
                  { service: 'google_classroom', name: 'Google Classroom', icon: <GraduationCap className="w-4 h-4 text-amber-600" />, desc: 'Manage courses, assignments, and rosters' },
                  { service: 'google_maps', name: 'Google Maps Platform', icon: <MapPin className="w-4 h-4 text-red-500" />, desc: 'Places search, routing, and real-world geolocation' },
                  { service: 'firebase_firestore', name: 'Firebase Firestore & Auth', icon: <Flame className="w-4 h-4 text-amber-500" />, desc: 'Persistent cloud database & authentication' },
                  { service: 'cloud_sql', name: 'Cloud SQL (PostgreSQL)', icon: <Database className="w-4 h-4 text-indigo-600" />, desc: 'Relational data queries and schema storage' },
                ].map((item) => {
                  const isConn = connectedServices.includes(item.service);
                  const isConnecting = connectingService === item.service;
                  return (
                    <div
                      key={item.service}
                      className={`p-3 rounded-xl border transition-all flex items-start justify-between ${
                        isConn
                          ? 'border-emerald-200 bg-emerald-50/40'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          {item.icon}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            {item.name}
                            {isConn && (
                              <span className="text-[10px] text-emerald-600 font-medium">Connected ✓</span>
                            )}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                            {item.desc}
                          </p>
                        </div>
                      </div>

                      {isConn ? (
                        <button
                          type="button"
                          onClick={() => handleDisconnectService(item.service)}
                          className="text-[11px] text-slate-400 hover:text-red-600 font-medium ml-2 cursor-pointer flex-shrink-0"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isConnecting}
                          onClick={() => handleConnectService(
                            item.service.startsWith('firebase') ? 'firebase' : item.service.startsWith('cloud') ? 'cloudsql' : 'google',
                            item.service,
                            item.name
                          )}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition-all ml-2 cursor-pointer disabled:opacity-50 flex-shrink-0"
                        >
                          {isConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Connect'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Microsoft Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Microsoft 365</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Outlook */}
                <div className={`p-4 rounded-xl border transition-all flex items-start justify-between ${
                  connectedServices.includes('outlook')
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 flex-shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                        Outlook Mail
                        {connectedServices.includes('outlook') && (
                          <span className="text-[10px] text-emerald-600 font-medium">Connected ✓</span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                        Exchange inbox search & follow-ups
                      </p>
                    </div>
                  </div>

                  {connectedServices.includes('outlook') ? (
                    <button
                      type="button"
                      onClick={() => handleDisconnectService('outlook')}
                      className="text-xs text-slate-400 hover:text-red-600 font-medium ml-2 cursor-pointer"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={connectingService === 'outlook'}
                      onClick={() => handleConnectService('microsoft', 'outlook', 'Outlook Mail')}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all ml-2 cursor-pointer disabled:opacity-50"
                    >
                      {connectingService === 'outlook' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Connect'}
                    </button>
                  )}
                </div>

                {/* OneDrive */}
                <div className={`p-4 rounded-xl border transition-all flex items-start justify-between ${
                  connectedServices.includes('onedrive')
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                      <Cloud className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                        OneDrive
                        {connectedServices.includes('onedrive') && (
                          <span className="text-[10px] text-emerald-600 font-medium">Connected ✓</span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                        Word, PowerPoint, and Excel spreadsheets
                      </p>
                    </div>
                  </div>

                  {connectedServices.includes('onedrive') ? (
                    <button
                      type="button"
                      onClick={() => handleDisconnectService('onedrive')}
                      className="text-xs text-slate-400 hover:text-red-600 font-medium ml-2 cursor-pointer"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={connectingService === 'onedrive'}
                      onClick={() => handleConnectService('microsoft', 'onedrive', 'OneDrive')}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all ml-2 cursor-pointer disabled:opacity-50"
                    >
                      {connectingService === 'onedrive' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Connect'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Permission Safety Explanation */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-start gap-3 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-800 font-medium">Security & Least-Privilege Access:</strong> Orbit requests read, search, and draft capabilities only to serve your prompts. Orbit never modifies or deletes external data without explicit confirmation.
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                Continue to Memory
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Memory */}
        {currentStep === 3 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Give Orbit a little context
              </h2>
              <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                Memory helps Orbit personalize future interactions, remember work constraints, and tailor its responses.
              </p>
            </div>

            {/* Import from connected apps (Transparent 'Coming Soon') */}
            <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Brain className="w-5 h-5 text-slate-400" />
                <div>
                  <h4 className="text-sm font-semibold text-slate-700">Auto-import context from connected apps</h4>
                  <p className="text-xs text-slate-400">Deep semantic indexing of recent meeting summaries and emails</p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-100">
                Coming soon
              </span>
            </div>

            {/* Custom Text Memory */}
            <div className="space-y-3">
              <label htmlFor="memory-input" className="block text-xs font-semibold text-slate-700">
                Tell Orbit something it should remember...
              </label>
              <textarea
                id="memory-input"
                rows={3}
                value={memoryText}
                onChange={(e) => setMemoryText(e.target.value)}
                placeholder="e.g. My preferred meeting time is after 4 PM, and I work with the product engineering squad on APAC timezone."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!memoryText.trim()}
                  onClick={handleSaveMemory}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
                >
                  Save memory
                </button>
              </div>

              {/* Saved Memories preview */}
              {savedMemories.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Saved preferences:</div>
                  {savedMemories.map((mem, idx) => (
                    <div key={idx} className="text-xs p-2.5 rounded-lg bg-purple-50/50 border border-purple-100 text-purple-900 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                      <span>{mem}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* File Upload Section */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Upload context files (PDF, Markdown, Notes)
              </label>
              <div className="relative border-2 border-dashed border-slate-200 hover:border-purple-300 rounded-xl p-6 text-center transition-colors">
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isUploading}
                  accept=".pdf,.txt,.md,.json,.csv,.doc,.docx"
                />
                <div className="flex flex-col items-center justify-center">
                  <Upload className="w-7 h-7 text-purple-500 mb-2" />
                  <p className="text-sm font-semibold text-slate-800">
                    Click to browse or drag and drop files
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Supports PDF, TXT, Markdown, CSV up to 15MB
                  </p>
                </div>
              </div>

              {/* File Upload States */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2 mt-3">
                  {uploadedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50 text-xs text-slate-700">
                      <div className="flex items-center gap-2 truncate">
                        <FileCheck className="w-4 h-4 text-purple-600 flex-shrink-0" />
                        <span className="truncate font-medium">{file.name}</span>
                      </div>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        file.status === 'ready' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-amber-100 text-amber-800 flex items-center gap-1'
                      }`}>
                        {file.status === 'uploading' && <><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</>}
                        {file.status === 'processing' && <><Loader2 className="w-3 h-3 animate-spin" /> Processing...</>}
                        {file.status === 'ready' && 'Ready ✓'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="pt-4 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                Review & Finish
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Review & Finish */}
        {currentStep === 4 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-10 text-center space-y-6">
            <div className="flex justify-center">
              <OrbitLogo size="xl" glow={true} />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Orbit is ready for you, {callName || firstName || 'there'}!
              </h2>
              <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                Your profile is configured, apps are connected, and custom memory is initialized. You are ready to enter your unified workspace.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-left space-y-2 max-w-md mx-auto text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="font-semibold text-slate-700">Display Name:</span>
                <span>{callName || firstName} {lastName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="font-semibold text-slate-700">Connected Services:</span>
                <span>{connectedServices.length} tools active</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-semibold text-slate-700">Memories Initialized:</span>
                <span>{savedMemories.length + uploadedFiles.length} items</span>
              </div>
            </div>

            <div className="pt-4 flex justify-center">
              <button
                id="enter-orbit-button"
                type="button"
                disabled={finalizing}
                onClick={handleCompleteOnboarding}
                className="px-8 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold shadow-md hover:shadow-lg flex items-center gap-2.5 transition-all cursor-pointer disabled:opacity-60"
              >
                {finalizing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Launching Orbit...
                  </>
                ) : (
                  <>
                    Enter Orbit AI Workspace
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
