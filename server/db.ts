import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { 
  UserProfile, 
  Integration, 
  Conversation, 
  ChatMessage, 
  MemoryItem, 
  TaskItem, 
  ScheduledTask, 
  SpecializedAgent, 
  UserSettings,
  MessageAttachment
} from '../src/types/index.ts';

export interface UserSession {
  id: string;
  token: string;
  userId: string;
  expiresAt: number;
  createdAt: string;
}

export interface OtpRecord {
  email: string;
  code: string;
  expiresAt: number;
  attempts: number;
  createdAt: string;
}

interface OrbitDatabase {
  users: Record<string, UserProfile>;
  sessions: Record<string, UserSession>;
  otps: Record<string, OtpRecord>;
  integrations: Record<string, Integration[]>; // key is userId
  conversations: Record<string, Conversation>;
  messages: Record<string, ChatMessage[]>; // key is conversationId
  memories: Record<string, MemoryItem[]>; // key is userId
  tasks: Record<string, TaskItem[]>; // key is userId
  scheduledTasks: Record<string, ScheduledTask[]>; // key is userId
  agents: Record<string, SpecializedAgent[]>; // key is userId
  settings: Record<string, UserSettings>; // key is userId
  attachments: Record<string, MessageAttachment & { userId: string; filePath: string }>;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'orbit_store.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadDatabase(): OrbitDatabase {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error loading database, initializing fresh store:', err);
  }

  const initialDb: OrbitDatabase = {
    users: {},
    sessions: {},
    otps: {},
    integrations: {},
    conversations: {},
    messages: {},
    memories: {},
    tasks: {},
    scheduledTasks: {},
    agents: {},
    settings: {},
    attachments: {},
  };

  saveDatabase(initialDb);
  return initialDb;
}

function saveDatabase(db: OrbitDatabase): void {
  try {
    const tmpPath = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tmpPath, DB_FILE);
  } catch (err) {
    console.error('Failed to persist database:', err);
  }
}

let dbInstance: OrbitDatabase = loadDatabase();

// --- Users & Profiles ---
export function getUserByEmail(email: string): UserProfile | undefined {
  const normEmail = email.trim().toLowerCase();
  return Object.values(dbInstance.users).find(u => u.email.toLowerCase() === normEmail);
}

export function getUserById(id: string): UserProfile | undefined {
  return dbInstance.users[id];
}

export function upsertUser(user: Partial<UserProfile> & { email: string }): UserProfile {
  const normEmail = user.email.trim().toLowerCase();
  let existing = getUserByEmail(normEmail);

  const now = new Date().toISOString();
  if (existing) {
    existing = {
      ...existing,
      ...user,
      email: normEmail,
      updatedAt: now,
    };
    dbInstance.users[existing.id] = existing;
    saveDatabase(dbInstance);
    return existing;
  }

  const id = user.id || `usr_${crypto.randomBytes(8).toString('hex')}`;
  const newUser: UserProfile = {
    id,
    email: normEmail,
    firstName: user.firstName || normEmail.split('@')[0] || 'User',
    lastName: user.lastName || '',
    callName: user.callName || user.firstName || normEmail.split('@')[0] || 'there',
    avatar: user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(normEmail)}&backgroundColor=8b5cf6`,
    provider: user.provider || 'email',
    onboardingCompleted: user.onboardingCompleted ?? false,
    createdAt: now,
    updatedAt: now,
  };

  dbInstance.users[id] = newUser;
  
  // Seed default user settings & default specialized agents
  if (!dbInstance.settings[id]) {
    dbInstance.settings[id] = {
      userId: id,
      theme: 'light',
      responsePreferences: 'Concise, clear, and proactive with actionable next steps.',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      emailNotifications: true,
      autoTitleEnabled: true,
      voiceInputLanguage: 'en-US',
    };
  }

  if (!dbInstance.agents[id]) {
    dbInstance.agents[id] = [
      {
        id: `agt_${crypto.randomBytes(6).toString('hex')}`,
        userId: id,
        name: 'Email Assistant',
        description: 'Triage inboxes, draft responses, and surface urgent follow-ups',
        instructions: 'Act as an executive communication assistant. Group emails by urgency and draft concise, courteous responses.',
        tools: ['search_gmail', 'get_email', 'draft_email'],
        icon: 'Mail',
        status: 'active',
        createdAt: now,
      },
      {
        id: `agt_${crypto.randomBytes(6).toString('hex')}`,
        userId: id,
        name: 'Daily Planner',
        description: 'Sync your calendar and tasks into a high-productivity agenda',
        instructions: 'Analyze today’s schedule, highlight conflicts, buffer focus time, and propose actionable daily priorities.',
        tools: ['search_calendar', 'create_calendar_event', 'search_tasks', 'create_task'],
        icon: 'Calendar',
        status: 'active',
        createdAt: now,
      },
      {
        id: `agt_${crypto.randomBytes(6).toString('hex')}`,
        userId: id,
        name: 'Knowledge & Drive Finder',
        description: 'Cross-reference documents, search memories, and summarize files',
        instructions: 'Search across connected Drive files and custom memory to synthesize research briefs and answer questions.',
        tools: ['search_drive', 'get_drive_file', 'search_memory'],
        icon: 'FileSearch',
        status: 'active',
        createdAt: now,
      }
    ];
  }

  saveDatabase(dbInstance);
  return newUser;
}

// --- Sessions ---
export function createSession(userId: string): UserSession {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const session: UserSession = {
    id: `ses_${crypto.randomBytes(8).toString('hex')}`,
    token,
    userId,
    expiresAt: now + (14 * 24 * 60 * 60 * 1000), // 14 days
    createdAt: new Date(now).toISOString(),
  };

  dbInstance.sessions[token] = session;
  saveDatabase(dbInstance);
  return session;
}

export function getSession(token: string): UserSession | undefined {
  if (!token) return undefined;
  const session = dbInstance.sessions[token];
  if (!session) return undefined;
  if (session.expiresAt < Date.now()) {
    delete dbInstance.sessions[token];
    saveDatabase(dbInstance);
    return undefined;
  }
  return session;
}

export function deleteSession(token: string): void {
  if (token && dbInstance.sessions[token]) {
    delete dbInstance.sessions[token];
    saveDatabase(dbInstance);
  }
}

// --- OTP Management ---
export function generateOtp(email: string): { code: string; expiresAt: number } {
  const normEmail = email.trim().toLowerCase();
  // 6-digit numeric OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes

  dbInstance.otps[normEmail] = {
    email: normEmail,
    code,
    expiresAt,
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  saveDatabase(dbInstance);
  return { code, expiresAt };
}

export function verifyOtp(email: string, code: string): { success: boolean; error?: string } {
  const normEmail = email.trim().toLowerCase();
  const record = dbInstance.otps[normEmail];

  if (!record) {
    return { success: false, error: 'No active OTP request found. Please request a new code.' };
  }

  if (record.expiresAt < Date.now()) {
    delete dbInstance.otps[normEmail];
    saveDatabase(dbInstance);
    return { success: false, error: 'The verification code has expired. Please request a new code.' };
  }

  if (record.attempts >= 5) {
    delete dbInstance.otps[normEmail];
    saveDatabase(dbInstance);
    return { success: false, error: 'Too many incorrect attempts. Please request a new code.' };
  }

  if (record.code !== code.trim()) {
    record.attempts += 1;
    saveDatabase(dbInstance);
    return { success: false, error: `Invalid verification code. ${5 - record.attempts} attempts remaining.` };
  }

  // Success
  delete dbInstance.otps[normEmail];
  saveDatabase(dbInstance);
  return { success: true };
}

export function getActiveOtp(email: string): OtpRecord | undefined {
  const normEmail = email.trim().toLowerCase();
  return dbInstance.otps[normEmail];
}

// --- Integrations ---
export function getUserIntegrations(userId: string): Integration[] {
  return dbInstance.integrations[userId] || [];
}

export function setIntegration(integration: Integration): void {
  const userId = integration.userId;
  if (!dbInstance.integrations[userId]) {
    dbInstance.integrations[userId] = [];
  }
  const idx = dbInstance.integrations[userId].findIndex(i => i.service === integration.service);
  if (idx >= 0) {
    dbInstance.integrations[userId][idx] = integration;
  } else {
    dbInstance.integrations[userId].push(integration);
  }
  saveDatabase(dbInstance);
}

export function disconnectIntegration(userId: string, service: string): void {
  if (!dbInstance.integrations[userId]) return;
  dbInstance.integrations[userId] = dbInstance.integrations[userId].filter(i => i.service !== service);
  saveDatabase(dbInstance);
}

// --- Conversations & Messages ---
export function getUserConversations(userId: string): Conversation[] {
  const list = Object.values(dbInstance.conversations).filter(c => c.userId === userId);
  return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getConversation(id: string): Conversation | undefined {
  return dbInstance.conversations[id];
}

export function createConversation(userId: string, title = 'New Conversation'): Conversation {
  const id = `conv_${crypto.randomBytes(8).toString('hex')}`;
  const now = new Date().toISOString();
  const conv: Conversation = {
    id,
    userId,
    title,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  };
  dbInstance.conversations[id] = conv;
  dbInstance.messages[id] = [];
  saveDatabase(dbInstance);
  return conv;
}

export function updateConversationTitle(id: string, title: string): void {
  if (dbInstance.conversations[id]) {
    dbInstance.conversations[id].title = title;
    dbInstance.conversations[id].updatedAt = new Date().toISOString();
    saveDatabase(dbInstance);
  }
}

export function deleteConversation(id: string): void {
  delete dbInstance.conversations[id];
  delete dbInstance.messages[id];
  saveDatabase(dbInstance);
}

export function getMessages(conversationId: string): ChatMessage[] {
  return dbInstance.messages[conversationId] || [];
}

export function appendMessage(conversationId: string, message: ChatMessage): void {
  if (!dbInstance.messages[conversationId]) {
    dbInstance.messages[conversationId] = [];
  }
  dbInstance.messages[conversationId].push(message);

  if (dbInstance.conversations[conversationId]) {
    dbInstance.conversations[conversationId].updatedAt = message.timestamp || new Date().toISOString();
    dbInstance.conversations[conversationId].messageCount = dbInstance.messages[conversationId].length;
  }
  saveDatabase(dbInstance);
}

export function updateMessage(conversationId: string, messageId: string, updates: Partial<ChatMessage>): void {
  const list = dbInstance.messages[conversationId];
  if (!list) return;
  const idx = list.findIndex(m => m.id === messageId);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...updates };
    saveDatabase(dbInstance);
  }
}

// --- Memories ---
export function getUserMemories(userId: string): MemoryItem[] {
  return dbInstance.memories[userId] || [];
}

export function addMemory(memory: MemoryItem): MemoryItem {
  if (!dbInstance.memories[memory.userId]) {
    dbInstance.memories[memory.userId] = [];
  }
  dbInstance.memories[memory.userId].unshift(memory);
  saveDatabase(dbInstance);
  return memory;
}

export function deleteMemory(userId: string, memoryId: string): void {
  if (!dbInstance.memories[userId]) return;
  dbInstance.memories[userId] = dbInstance.memories[userId].filter(m => m.id !== memoryId);
  saveDatabase(dbInstance);
}

// --- Tasks ---
export function getUserTasks(userId: string): TaskItem[] {
  return dbInstance.tasks[userId] || [];
}

export function addTask(task: TaskItem): TaskItem {
  if (!dbInstance.tasks[task.userId]) {
    dbInstance.tasks[task.userId] = [];
  }
  dbInstance.tasks[task.userId].unshift(task);
  saveDatabase(dbInstance);
  return task;
}

export function updateTask(userId: string, taskId: string, updates: Partial<TaskItem>): TaskItem | undefined {
  const list = dbInstance.tasks[userId];
  if (!list) return undefined;
  const idx = list.findIndex(t => t.id === taskId);
  if (idx < 0) return undefined;
  list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
  saveDatabase(dbInstance);
  return list[idx];
}

export function deleteTask(userId: string, taskId: string): void {
  if (!dbInstance.tasks[userId]) return;
  dbInstance.tasks[userId] = dbInstance.tasks[userId].filter(t => t.id !== taskId);
  saveDatabase(dbInstance);
}

// --- Scheduled Tasks ---
export function getUserScheduledTasks(userId: string): ScheduledTask[] {
  return dbInstance.scheduledTasks[userId] || [];
}

export function addScheduledTask(task: ScheduledTask): ScheduledTask {
  if (!dbInstance.scheduledTasks[task.userId]) {
    dbInstance.scheduledTasks[task.userId] = [];
  }
  dbInstance.scheduledTasks[task.userId].push(task);
  saveDatabase(dbInstance);
  return task;
}

export function updateScheduledTask(userId: string, taskId: string, updates: Partial<ScheduledTask>): ScheduledTask | undefined {
  const list = dbInstance.scheduledTasks[userId];
  if (!list) return undefined;
  const idx = list.findIndex(t => t.id === taskId);
  if (idx < 0) return undefined;
  list[idx] = { ...list[idx], ...updates };
  saveDatabase(dbInstance);
  return list[idx];
}

export function deleteScheduledTask(userId: string, taskId: string): void {
  if (!dbInstance.scheduledTasks[userId]) return;
  dbInstance.scheduledTasks[userId] = dbInstance.scheduledTasks[userId].filter(t => t.id !== taskId);
  saveDatabase(dbInstance);
}

// --- Agents ---
export function getUserAgents(userId: string): SpecializedAgent[] {
  return dbInstance.agents[userId] || [];
}

export function addAgent(agent: SpecializedAgent): SpecializedAgent {
  if (!dbInstance.agents[agent.userId]) {
    dbInstance.agents[agent.userId] = [];
  }
  dbInstance.agents[agent.userId].push(agent);
  saveDatabase(dbInstance);
  return agent;
}

export function updateAgent(userId: string, agentId: string, updates: Partial<SpecializedAgent>): SpecializedAgent | undefined {
  const list = dbInstance.agents[userId];
  if (!list) return undefined;
  const idx = list.findIndex(a => a.id === agentId);
  if (idx < 0) return undefined;
  list[idx] = { ...list[idx], ...updates };
  saveDatabase(dbInstance);
  return list[idx];
}

export function deleteAgent(userId: string, agentId: string): void {
  if (!dbInstance.agents[userId]) return;
  dbInstance.agents[userId] = dbInstance.agents[userId].filter(a => a.id !== agentId);
  saveDatabase(dbInstance);
}

// --- Settings ---
export function getUserSettings(userId: string): UserSettings {
  if (!dbInstance.settings[userId]) {
    dbInstance.settings[userId] = {
      userId,
      theme: 'light',
      responsePreferences: 'Concise, structured, and proactive with next steps.',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      emailNotifications: true,
      autoTitleEnabled: true,
      voiceInputLanguage: 'en-US',
    };
    saveDatabase(dbInstance);
  }
  return dbInstance.settings[userId];
}

export function updateUserSettings(userId: string, updates: Partial<UserSettings>): UserSettings {
  const current = getUserSettings(userId);
  dbInstance.settings[userId] = { ...current, ...updates };
  saveDatabase(dbInstance);
  return dbInstance.settings[userId];
}

// --- Attachments ---
export function saveAttachmentRecord(record: MessageAttachment & { userId: string; filePath: string }): void {
  dbInstance.attachments[record.id] = record;
  saveDatabase(dbInstance);
}

export function getAttachmentRecord(id: string) {
  return dbInstance.attachments[id];
}
