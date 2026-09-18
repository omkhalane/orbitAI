import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import * as db from './server/db.ts';
import { streamChatResponse, generateChatTitle, executeToolCall } from './server/ai.ts';
import type { MessageAttachment, ChatMessage } from './src/types/index.ts';

const app = express();
const PORT = 3000;

// Body parsing
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static uploads directory
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// Multer storage setup
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (_req, file, cb) => {
    // Validate common productivity file types
    const allowed = [
      'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml',
      'application/pdf', 'text/plain', 'text/markdown', 'text/csv',
      'application/json', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('text/')) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not supported. Please upload PDF, images, docs, or text files.`));
    }
  }
});

// Authentication extraction middleware
interface AuthRequest extends Request {
  userId?: string;
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  let token = '';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.headers.cookie) {
    const match = req.headers.cookie.match(/orbit_session=([^;]+)/);
    if (match) token = match[1];
  }

  if (token) {
    const session = db.getSession(token);
    if (session) {
      req.userId = session.userId;
    }
  }
  next();
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(401).json({ error: 'Authentication required. Please sign in to Orbit AI.' });
    return;
  }
  next();
}

app.use(authMiddleware);

// --- STRICT INPUT VALIDATION UTILITIES ---
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const OTP_REGEX = /^\d{6}$/;

function isValidEmail(email: unknown): email is string {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  return trimmed.length >= 5 && trimmed.length <= 120 && EMAIL_REGEX.test(trimmed);
}

function isValidOtp(code: unknown): code is string {
  if (typeof code !== 'string') return false;
  return OTP_REGEX.test(code.trim());
}

function cleanString(val: unknown, maxLen = 255): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

// --- API ROUTES ---

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Auth: Send Email OTP with strict validation
app.post('/api/auth/otp/send', (req, res) => {
  const { email } = req.body;
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Please enter a valid, well-formed email address.' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const { code, expiresAt } = db.generateOtp(cleanEmail);
  console.log(`[Orbit Auth] Generated OTP for ${cleanEmail}: ${code} (expires in 10 minutes)`);

  res.json({
    success: true,
    message: `Verification code sent to ${cleanEmail}.`,
    expiresAt,
    devCode: process.env.NODE_ENV !== 'production' ? code : undefined,
  });
});

// Auth: Verify Email OTP with strict validation
app.post('/api/auth/otp/verify', (req, res) => {
  const { email, code } = req.body;
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'A valid email address is required.' });
    return;
  }
  if (!isValidOtp(code)) {
    res.status(400).json({ error: 'Verification code must be exactly 6 numeric digits.' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const verification = db.verifyOtp(cleanEmail, code.trim());
  if (!verification.success) {
    res.status(400).json({ error: verification.error });
    return;
  }

  // Create or retrieve user
  const user = db.upsertUser({
    email: cleanEmail,
    provider: 'email',
  });

  const session = db.createSession(user.id);
  res.setHeader('Set-Cookie', `orbit_session=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${14 * 24 * 3600}`);
  res.json({
    success: true,
    user,
    token: session.token,
  });
});

// Auth: Google Sign-In / OAuth with strict validation
app.post('/api/auth/oauth/google', (req, res) => {
  const { email, name, avatar } = req.body;
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Google authentication requires a valid email address.' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const safeName = cleanString(name, 100);
  const parts = safeName.split(' ');
  const firstName = parts[0] || cleanEmail.split('@')[0] || 'User';
  const lastName = parts.slice(1).join(' ') || '';

  const user = db.upsertUser({
    email: cleanEmail,
    firstName: cleanString(firstName, 50),
    lastName: cleanString(lastName, 50),
    callName: cleanString(firstName, 50),
    avatar: typeof avatar === 'string' && avatar.startsWith('http') ? avatar : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(safeName || cleanEmail)}&backgroundColor=0284c7`,
    provider: 'google',
  });

  const session = db.createSession(user.id);
  res.setHeader('Set-Cookie', `orbit_session=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${14 * 24 * 3600}`);
  res.json({
    success: true,
    user,
    token: session.token,
  });
});

// Auth: Microsoft / Outlook Sign-In with strict validation
app.post('/api/auth/oauth/microsoft', (req, res) => {
  const { email, name } = req.body;
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Microsoft authentication requires a valid email address.' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const safeName = cleanString(name, 100);
  const parts = safeName.split(' ');
  const firstName = parts[0] || cleanEmail.split('@')[0] || 'User';
  const lastName = parts.slice(1).join(' ') || '';

  const user = db.upsertUser({
    email: cleanEmail,
    firstName: cleanString(firstName, 50),
    lastName: cleanString(lastName, 50),
    callName: cleanString(firstName, 50),
    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(safeName || cleanEmail)}&backgroundColor=2563eb`,
    provider: 'microsoft',
  });

  const session = db.createSession(user.id);
  res.setHeader('Set-Cookie', `orbit_session=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${14 * 24 * 3600}`);
  res.json({
    success: true,
    user,
    token: session.token,
  });
});

// Auth: Current user
app.get('/api/auth/me', (req: AuthRequest, res) => {
  if (!req.userId) {
    res.json({ authenticated: false, user: null });
    return;
  }
  const user = db.getUserById(req.userId);
  if (!user) {
    res.json({ authenticated: false, user: null });
    return;
  }
  res.json({ authenticated: true, user });
});

// Auth: Logout
app.post('/api/auth/logout', (req: AuthRequest, res) => {
  let token = '';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.headers.cookie) {
    const match = req.headers.cookie.match(/orbit_session=([^;]+)/);
    if (match) token = match[1];
  }
  if (token) db.deleteSession(token);
  res.setHeader('Set-Cookie', `orbit_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
  res.json({ success: true });
});

// --- USER & ONBOARDING WITH STRICT VALIDATION ---
app.post('/api/user/profile', requireAuth, (req: AuthRequest, res) => {
  const { firstName, lastName, callName, avatar } = req.body;
  const user = db.getUserById(req.userId!);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const cleanFirst = firstName !== undefined ? cleanString(firstName, 50) : user.firstName;
  const cleanLast = lastName !== undefined ? cleanString(lastName, 50) : user.lastName;
  const cleanCall = callName !== undefined ? cleanString(callName, 50) : user.callName;

  if (firstName !== undefined && cleanFirst.length === 0) {
    res.status(400).json({ error: 'First name cannot be empty.' });
    return;
  }

  const updated = db.upsertUser({
    ...user,
    firstName: cleanFirst,
    lastName: cleanLast,
    callName: cleanCall || cleanFirst,
    avatar: avatar && typeof avatar === 'string' && (avatar.startsWith('http') || avatar.startsWith('/')) ? avatar : user.avatar,
  });

  res.json({ success: true, user: updated });
});

app.post('/api/user/onboarding/complete', requireAuth, (req: AuthRequest, res) => {
  const user = db.getUserById(req.userId!);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const updated = db.upsertUser({
    ...user,
    onboardingCompleted: true,
  });

  res.json({ success: true, user: updated });
});

// --- INTEGRATIONS ---
app.get('/api/integrations', requireAuth, (req: AuthRequest, res) => {
  const integrations = db.getUserIntegrations(req.userId!);
  res.json({ integrations });
});

app.post('/api/integrations/connect', requireAuth, (req: AuthRequest, res) => {
  const { provider, service, permissions, accountEmail, name } = req.body;
  if (!provider || !service) {
    res.status(400).json({ error: 'Provider and service are required.' });
    return;
  }

  const user = db.getUserById(req.userId!)!;
  const newIntegration = {
    id: `int_${provider}_${service}_${req.userId}`,
    userId: req.userId!,
    provider,
    service,
    name: name || service.replace('_', ' ').toUpperCase(),
    status: 'connected' as const,
    permissions: permissions || ['read', 'search', 'draft'],
    accountEmail: accountEmail || user.email,
    lastSynced: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  db.setIntegration(newIntegration);
  res.json({ success: true, integration: newIntegration });
});

app.post('/api/integrations/disconnect', requireAuth, (req: AuthRequest, res) => {
  const { service } = req.body;
  if (!service) {
    res.status(400).json({ error: 'Service name is required.' });
    return;
  }
  db.disconnectIntegration(req.userId!, service);
  res.json({ success: true });
});

app.post('/api/integrations/sync', requireAuth, (req: AuthRequest, res) => {
  const { service } = req.body;
  const integrations = db.getUserIntegrations(req.userId!);
  const target = integrations.find(i => i.service === service);
  if (!target) {
    res.status(404).json({ error: 'Integration not found.' });
    return;
  }
  target.lastSynced = new Date().toISOString();
  db.setIntegration(target);
  res.json({ success: true, lastSynced: target.lastSynced });
});

// --- CONVERSATIONS ---
app.get('/api/conversations', requireAuth, (req: AuthRequest, res) => {
  const conversations = db.getUserConversations(req.userId!);
  res.json({ conversations });
});

app.post('/api/conversations', requireAuth, (req: AuthRequest, res) => {
  const { title } = req.body;
  const conv = db.createConversation(req.userId!, title || 'New Chat');
  res.json({ conversation: conv });
});

app.get('/api/conversations/:id', requireAuth, (req: AuthRequest, res) => {
  const conv = db.getConversation(req.params.id);
  if (!conv || conv.userId !== req.userId) {
    res.status(404).json({ error: 'Conversation not found.' });
    return;
  }
  const messages = db.getMessages(conv.id);
  res.json({ conversation: conv, messages });
});

app.delete('/api/conversations/:id', requireAuth, (req: AuthRequest, res) => {
  const conv = db.getConversation(req.params.id);
  if (!conv || conv.userId !== req.userId) {
    res.status(404).json({ error: 'Conversation not found.' });
    return;
  }
  db.deleteConversation(conv.id);
  res.json({ success: true });
});

// --- CHAT STREAMING WITH TOOL CALLING ---
app.post('/api/chat/stream', requireAuth, async (req: AuthRequest, res) => {
  const { conversationId, message, attachments = [] } = req.body;

  if (!conversationId || !message) {
    res.status(400).json({ error: 'conversationId and message are required.' });
    return;
  }

  const conv = db.getConversation(conversationId);
  if (!conv || conv.userId !== req.userId) {
    res.status(404).json({ error: 'Conversation not found.' });
    return;
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Save user message to database
  const userMsgId = `msg_${Date.now()}_user`;
  const userMessage: ChatMessage = {
    id: userMsgId,
    conversationId,
    role: 'user',
    content: message,
    timestamp: new Date().toISOString(),
    attachments,
  };
  db.appendMessage(conversationId, userMessage);

  // Check if conversation is fresh and auto-generate title asynchronously
  const existingMessages = db.getMessages(conversationId);
  if (existingMessages.length <= 1 || conv.title === 'New Chat') {
    generateChatTitle(message).then(newTitle => {
      db.updateConversationTitle(conversationId, newTitle);
      res.write(`data: ${JSON.stringify({ type: 'title_update', title: newTitle })}\n\n`);
    }).catch(console.error);
  }

  const assistantMsgId = `msg_${Date.now()}_assistant`;
  const recordedToolCalls: any[] = [];
  let fullAssistantText = '';

  try {
    await streamChatResponse(
      req.userId!,
      conversationId,
      message,
      attachments,
      (chunk) => {
        if (chunk.type === 'tool_call') {
          recordedToolCalls.push(chunk.payload);
        } else if (chunk.type === 'tool_result') {
          const match = recordedToolCalls.find(tc => tc.name === chunk.payload.name);
          if (match) {
            match.result = chunk.payload.result;
            match.status = chunk.payload.requiresConfirmation ? 'pending' : 'executed';
            match.requiresConfirmation = chunk.payload.requiresConfirmation;
          }
        } else if (chunk.type === 'text' && chunk.content) {
          fullAssistantText += chunk.content;
        }

        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    );

    // Persist final assistant response
    const assistantMessage: ChatMessage = {
      id: assistantMsgId,
      conversationId,
      role: 'assistant',
      content: fullAssistantText,
      timestamp: new Date().toISOString(),
      toolCalls: recordedToolCalls.length > 0 ? recordedToolCalls : undefined,
    };
    db.appendMessage(conversationId, assistantMessage);

    res.write(`data: ${JSON.stringify({ type: 'message_persisted', messageId: assistantMsgId })}\n\n`);
    res.end();
  } catch (err: any) {
    console.error('Error during chat stream:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', error: err.message || 'Orbit AI encountered an unexpected error.' })}\n\n`);
    res.end();
  }
});

// Tool action confirmation / execution endpoint
app.post('/api/chat/tool/confirm', requireAuth, async (req: AuthRequest, res) => {
  const { toolName, args } = req.body;
  try {
    const result = await executeToolCall(req.userId!, toolName, { ...args, confirmed: true });
    res.json({ success: true, result: result.result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- FILE UPLOADS ---
app.post('/api/upload', requireAuth, upload.single('file'), (req: AuthRequest, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No file provided.' });
    return;
  }

  const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const attachment: MessageAttachment = {
    id,
    name: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    url: `/uploads/${file.filename}`,
    status: 'ready',
  };

  db.saveAttachmentRecord({
    ...attachment,
    userId: req.userId!,
    filePath: file.path,
  });

  // If text or json, extract content into user's searchable memory
  if (file.mimetype.startsWith('text/') || file.mimetype === 'application/json') {
    try {
      const textContent = fs.readFileSync(file.path, 'utf-8').slice(0, 3000);
      db.addMemory({
        id: `mem_file_${id}`,
        userId: req.userId!,
        source: 'uploaded_file',
        type: 'work_context',
        content: `Extracted from uploaded document "${file.originalname}": ${textContent.slice(0, 500)}`,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Could not extract text from file:', e);
    }
  }

  res.json({ success: true, attachment });
});

// --- MEMORIES ---
app.get('/api/memories', requireAuth, (req: AuthRequest, res) => {
  const memories = db.getUserMemories(req.userId!);
  res.json({ memories });
});

app.post('/api/memories', requireAuth, (req: AuthRequest, res) => {
  const { content, type, source } = req.body;
  if (!content) {
    res.status(400).json({ error: 'Memory content cannot be empty.' });
    return;
  }

  const memory = db.addMemory({
    id: `mem_${Date.now()}`,
    userId: req.userId!,
    source: source || 'user_created',
    type: type || 'preference',
    content,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  res.json({ success: true, memory });
});

app.delete('/api/memories/:id', requireAuth, (req: AuthRequest, res) => {
  db.deleteMemory(req.userId!, req.params.id);
  res.json({ success: true });
});

// --- TASKS ---
app.get('/api/tasks', requireAuth, (req: AuthRequest, res) => {
  const tasks = db.getUserTasks(req.userId!);
  res.json({ tasks });
});

app.post('/api/tasks', requireAuth, (req: AuthRequest, res) => {
  const { title, dueTime, priority } = req.body;
  if (!title) {
    res.status(400).json({ error: 'Task title is required.' });
    return;
  }

  const task = db.addTask({
    id: `tsk_${Date.now()}`,
    userId: req.userId!,
    title,
    dueTime: dueTime || 'Today',
    priority: priority || 'medium',
    status: 'pending',
    source: 'user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  res.json({ success: true, task });
});

app.patch('/api/tasks/:id', requireAuth, (req: AuthRequest, res) => {
  const updated = db.updateTask(req.userId!, req.params.id, req.body);
  if (!updated) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  res.json({ success: true, task: updated });
});

app.delete('/api/tasks/:id', requireAuth, (req: AuthRequest, res) => {
  db.deleteTask(req.userId!, req.params.id);
  res.json({ success: true });
});

// --- SCHEDULED TASKS ---
app.get('/api/scheduled-tasks', requireAuth, (req: AuthRequest, res) => {
  const scheduledTasks = db.getUserScheduledTasks(req.userId!);
  res.json({ scheduledTasks });
});

app.post('/api/scheduled-tasks', requireAuth, (req: AuthRequest, res) => {
  const { title, prompt, scheduleDescription, cronExpression } = req.body;
  if (!title || !prompt) {
    res.status(400).json({ error: 'Title and prompt are required.' });
    return;
  }

  const task = db.addScheduledTask({
    id: `sched_${Date.now()}`,
    userId: req.userId!,
    title,
    prompt,
    scheduleDescription: scheduleDescription || 'Every weekday at 8:00 AM',
    cronExpression: cronExpression || '0 8 * * 1-5',
    enabled: true,
    createdAt: new Date().toISOString(),
  });

  res.json({ success: true, task });
});

app.patch('/api/scheduled-tasks/:id', requireAuth, (req: AuthRequest, res) => {
  const updated = db.updateScheduledTask(req.userId!, req.params.id, req.body);
  if (!updated) {
    res.status(404).json({ error: 'Scheduled task not found' });
    return;
  }
  res.json({ success: true, task: updated });
});

app.delete('/api/scheduled-tasks/:id', requireAuth, (req: AuthRequest, res) => {
  db.deleteScheduledTask(req.userId!, req.params.id);
  res.json({ success: true });
});

// --- AGENTS ---
app.get('/api/agents', requireAuth, (req: AuthRequest, res) => {
  const agents = db.getUserAgents(req.userId!);
  res.json({ agents });
});

app.post('/api/agents', requireAuth, (req: AuthRequest, res) => {
  const { name, description, instructions, tools, icon } = req.body;
  if (!name || !instructions) {
    res.status(400).json({ error: 'Name and instructions are required.' });
    return;
  }

  const agent = db.addAgent({
    id: `agt_${Date.now()}`,
    userId: req.userId!,
    name,
    description: description || '',
    instructions,
    tools: tools || ['search_gmail', 'search_calendar'],
    icon: icon || 'Bot',
    status: 'active',
    createdAt: new Date().toISOString(),
  });

  res.json({ success: true, agent });
});

app.patch('/api/agents/:id', requireAuth, (req: AuthRequest, res) => {
  const updated = db.updateAgent(req.userId!, req.params.id, req.body);
  if (!updated) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json({ success: true, agent: updated });
});

app.delete('/api/agents/:id', requireAuth, (req: AuthRequest, res) => {
  db.deleteAgent(req.userId!, req.params.id);
  res.json({ success: true });
});

// --- SETTINGS ---
app.get('/api/settings', requireAuth, (req: AuthRequest, res) => {
  const settings = db.getUserSettings(req.userId!);
  res.json({ settings });
});

app.patch('/api/settings', requireAuth, (req: AuthRequest, res) => {
  const updated = db.updateUserSettings(req.userId!, req.body);
  res.json({ success: true, settings: updated });
});

// --- VITE MIDDLEWARE & STATIC SERVING ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Orbit AI] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
