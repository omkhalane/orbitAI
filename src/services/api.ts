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
} from '../types/index.ts';

const API_BASE = '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('orbit_token');
  const googleToken = localStorage.getItem('google_access_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (googleToken) {
    headers['x-google-access-token'] = googleToken;
  }
  return headers;
}

export const api = {
  // Auth
  async sendOtp(email: string): Promise<{ success: boolean; message: string; devCode?: string; error?: string }> {
    const res = await fetch(`${API_BASE}/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return res.json();
  },

  async verifyOtp(email: string, code: string): Promise<{ success: boolean; user?: UserProfile; token?: string; error?: string }> {
    const res = await fetch(`${API_BASE}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('orbit_token', data.token);
    }
    return data;
  },

  async signInWithGoogle(email: string, name: string, avatar?: string, accessToken?: string): Promise<{ success: boolean; user: UserProfile; token: string }> {
    if (accessToken) {
      localStorage.setItem('google_access_token', accessToken);
    }
    const res = await fetch(`${API_BASE}/auth/oauth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, avatar, accessToken }),
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('orbit_token', data.token);
    }
    return data;
  },

  async signInWithMicrosoft(email: string, name: string): Promise<{ success: boolean; user: UserProfile; token: string }> {
    const res = await fetch(`${API_BASE}/auth/oauth/microsoft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('orbit_token', data.token);
    }
    return data;
  },

  async getMe(): Promise<{ authenticated: boolean; user: UserProfile | null }> {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return { authenticated: false, user: null };
      return res.json();
    } catch {
      return { authenticated: false, user: null };
    }
  },

  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    } finally {
      localStorage.removeItem('orbit_token');
    }
  },

  // User Profile & Onboarding
  async updateProfile(updates: Partial<UserProfile>): Promise<{ success: boolean; user: UserProfile }> {
    const res = await fetch(`${API_BASE}/user/profile`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    return res.json();
  },

  async completeOnboarding(): Promise<{ success: boolean; user: UserProfile }> {
    const res = await fetch(`${API_BASE}/user/onboarding/complete`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // Integrations
  async getIntegrations(): Promise<{ integrations: Integration[] }> {
    const res = await fetch(`${API_BASE}/integrations`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async connectIntegration(payload: { provider: string; service: string; permissions?: string[]; name?: string; accountEmail?: string }): Promise<{ success: boolean; integration: Integration }> {
    const res = await fetch(`${API_BASE}/integrations/connect`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async disconnectIntegration(service: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/integrations/disconnect`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ service }),
    });
    return res.json();
  },

  async syncIntegration(service: string): Promise<{ success: boolean; lastSynced: string }> {
    const res = await fetch(`${API_BASE}/integrations/sync`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ service }),
    });
    return res.json();
  },

  // Conversations
  async getConversations(): Promise<{ conversations: Conversation[] }> {
    const res = await fetch(`${API_BASE}/conversations`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async createConversation(title?: string): Promise<{ conversation: Conversation }> {
    const res = await fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title }),
    });
    return res.json();
  },

  async getConversation(id: string): Promise<{ conversation: Conversation; messages: ChatMessage[] }> {
    const res = await fetch(`${API_BASE}/conversations/${id}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async deleteConversation(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/conversations/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // File Upload
  async uploadFile(file: File): Promise<{ success: boolean; attachment: MessageAttachment; error?: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('orbit_token');
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return res.json();
  },

  // Memories
  async getMemories(): Promise<{ memories: MemoryItem[] }> {
    const res = await fetch(`${API_BASE}/memories`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async addMemory(content: string, type = 'preference', source = 'user_created'): Promise<{ success: boolean; memory: MemoryItem }> {
    const res = await fetch(`${API_BASE}/memories`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content, type, source }),
    });
    return res.json();
  },

  async deleteMemory(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/memories/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // Tasks
  async getTasks(): Promise<{ tasks: TaskItem[] }> {
    const res = await fetch(`${API_BASE}/tasks`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async createTask(payload: { title: string; dueTime?: string; priority?: string }): Promise<{ success: boolean; task: TaskItem }> {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async updateTask(id: string, updates: Partial<TaskItem>): Promise<{ success: boolean; task: TaskItem }> {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    return res.json();
  },

  async deleteTask(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // Scheduled Tasks
  async getScheduledTasks(): Promise<{ scheduledTasks: ScheduledTask[] }> {
    const res = await fetch(`${API_BASE}/scheduled-tasks`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async createScheduledTask(payload: { title: string; prompt: string; scheduleDescription: string }): Promise<{ success: boolean; task: ScheduledTask }> {
    const res = await fetch(`${API_BASE}/scheduled-tasks`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async toggleScheduledTask(id: string, enabled: boolean): Promise<{ success: boolean; task: ScheduledTask }> {
    const res = await fetch(`${API_BASE}/scheduled-tasks/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ enabled }),
    });
    return res.json();
  },

  async deleteScheduledTask(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/scheduled-tasks/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // Agents
  async getAgents(): Promise<{ agents: SpecializedAgent[] }> {
    const res = await fetch(`${API_BASE}/agents`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async createAgent(payload: { name: string; description: string; instructions: string; tools?: string[]; icon?: string }): Promise<{ success: boolean; agent: SpecializedAgent }> {
    const res = await fetch(`${API_BASE}/agents`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async deleteAgent(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/agents/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // Settings
  async getSettings(): Promise<{ settings: UserSettings }> {
    const res = await fetch(`${API_BASE}/settings`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async updateSettings(updates: Partial<UserSettings>): Promise<{ success: boolean; settings: UserSettings }> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    return res.json();
  },

  // Tool Confirmation
  async confirmToolAction(toolName: string, args: Record<string, any>, approvalId?: string): Promise<{ success: boolean; result: any }> {
    const res = await fetch(`${API_BASE}/chat/tool/confirm`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ toolName, args, approvalId }),
    });
    return res.json();
  },

  // AI Models, Credentials & Usage
  async getAiModels(): Promise<{ models: any[] }> {
    const res = await fetch(`${API_BASE}/ai/models`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async getAiCredentials(): Promise<{ credentials: any[] }> {
    const res = await fetch(`${API_BASE}/ai/credentials`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async saveAiCredential(provider: string, apiKey: string): Promise<{ success: boolean; credential: any; error?: string }> {
    const res = await fetch(`${API_BASE}/ai/credentials`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ provider, apiKey }),
    });
    return res.json();
  },

  async deleteAiCredential(provider: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/ai/credentials/${provider}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async getAiUsage(): Promise<{ usage: any[]; entitlement: any }> {
    const res = await fetch(`${API_BASE}/ai/usage`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // OAuth Connections
  async getOAuthConnections(): Promise<{ connections: any[] }> {
    const res = await fetch(`${API_BASE}/oauth/connections`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async saveOAuthConnection(payload: {
    provider: string;
    accessToken: string;
    refreshToken?: string;
    scopes?: string[];
    expiresAt?: number;
    accountEmail?: string;
  }): Promise<{ success: boolean; connection: any }> {
    const res = await fetch(`${API_BASE}/oauth/connections`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async disconnectOAuthConnection(provider: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/oauth/connections/${provider}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return res.json();
  },
};
