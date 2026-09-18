import { GoogleGenAI, Type, type FunctionDeclaration } from '@google/genai';
import * as db from './db.ts';
import type { UserProfile, ChatMessage, ToolCallPayload, MemoryItem } from '../src/types/index.ts';

let aiInstance: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

// Complete Google Workspace & Productivity Tools Declarations
const tools: { functionDeclarations: FunctionDeclaration[] } = {
  functionDeclarations: [
    // 1. GMAIL
    {
      name: 'search_gmail',
      description: 'Search messages, conversations, and threads in user connected Gmail inbox',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description: 'Search query or filters (e.g. "from:sarah", "is:unread", "roadmap")',
          },
          maxResults: {
            type: Type.NUMBER,
            description: 'Maximum number of results to return (default 5)',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_email',
      description: 'Retrieve full email content and body for a specific email message ID',
      parameters: {
        type: Type.OBJECT,
        properties: {
          emailId: {
            type: Type.STRING,
            description: 'The unique message ID of the email to inspect',
          },
        },
        required: ['emailId'],
      },
    },
    {
      name: 'draft_email',
      description: 'Create a draft email in Gmail client for user review',
      parameters: {
        type: Type.OBJECT,
        properties: {
          to: { type: Type.STRING, description: 'Recipient email address' },
          subject: { type: Type.STRING, description: 'Subject line' },
          body: { type: Type.STRING, description: 'Email body text or markdown' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
    {
      name: 'send_email',
      description: 'Send an email directly through Gmail. Consequential action requiring confirmation.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          to: { type: Type.STRING, description: 'Recipient email address' },
          subject: { type: Type.STRING, description: 'Subject of email' },
          body: { type: Type.STRING, description: 'Email body' },
          confirmed: { type: Type.BOOLEAN, description: 'Explicit user confirmation' },
        },
        required: ['to', 'subject', 'body'],
      },
    },

    // 2. GOOGLE CALENDAR
    {
      name: 'search_calendar',
      description: 'Search for scheduled meetings and events on Google Calendar',
      parameters: {
        type: Type.OBJECT,
        properties: {
          timeMin: { type: Type.STRING, description: 'Start time ISO or relative ("today", "tomorrow")' },
          timeMax: { type: Type.STRING, description: 'End time ISO' },
          query: { type: Type.STRING, description: 'Keyword to match event title or attendees' },
        },
      },
    },
    {
      name: 'create_calendar_event',
      description: 'Schedule a new event on Google Calendar',
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'Event title' },
          startTime: { type: Type.STRING, description: 'Start time (ISO or recognized format)' },
          endTime: { type: Type.STRING, description: 'End time (ISO or duration)' },
          attendees: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Attendee emails' },
          description: { type: Type.STRING, description: 'Event agenda or description' },
          addMeetLink: { type: Type.BOOLEAN, description: 'Whether to attach a Google Meet link' },
        },
        required: ['title', 'startTime'],
      },
    },

    // 3. GOOGLE DRIVE
    {
      name: 'search_drive',
      description: 'Search documents, presentations, sheets, and files across Google Drive',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: 'Search term for file title or contents' },
          fileType: { type: Type.STRING, description: 'Filter: "document", "spreadsheet", "presentation", "pdf"' },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_drive_file',
      description: 'Retrieve content, text summary, and metadata for a specific Drive file',
      parameters: {
        type: Type.OBJECT,
        properties: {
          fileId: { type: Type.STRING, description: 'Drive file ID' },
        },
        required: ['fileId'],
      },
    },

    // 4. GOOGLE SHEETS
    {
      name: 'read_google_sheet',
      description: 'Read spreadsheet data, rows, and cells from a Google Sheet',
      parameters: {
        type: Type.OBJECT,
        properties: {
          spreadsheetId: { type: Type.STRING, description: 'Google Sheet ID or title' },
          range: { type: Type.STRING, description: 'A1 range or sheet tab name (e.g. "Sheet1!A1:E10")' },
        },
        required: ['spreadsheetId'],
      },
    },
    {
      name: 'update_google_sheet',
      description: 'Append or update rows in a Google Sheet',
      parameters: {
        type: Type.OBJECT,
        properties: {
          spreadsheetId: { type: Type.STRING, description: 'Google Sheet ID' },
          range: { type: Type.STRING, description: 'Target range or sheet tab' },
          values: { 
            type: Type.ARRAY, 
            items: { type: Type.ARRAY, items: { type: Type.STRING } },
            description: '2D array of row values to write' 
          },
        },
        required: ['spreadsheetId', 'values'],
      },
    },

    // 5. GOOGLE DOCS
    {
      name: 'read_google_doc',
      description: 'Read the full document text and headings from a Google Doc',
      parameters: {
        type: Type.OBJECT,
        properties: {
          docId: { type: Type.STRING, description: 'Google Document ID or title' },
        },
        required: ['docId'],
      },
    },
    {
      name: 'create_google_doc',
      description: 'Create a new Google Document with formatted text',
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'Document title' },
          content: { type: Type.STRING, description: 'Body text or markdown content' },
        },
        required: ['title', 'content'],
      },
    },

    // 6. GOOGLE SLIDES
    {
      name: 'search_google_slides',
      description: 'Search slide decks and presentations in Google Slides',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: 'Keyword to search deck titles or slide text' },
        },
        required: ['query'],
      },
    },

    // 7. GOOGLE TASKS
    {
      name: 'create_task',
      description: 'Create an actionable task item in Google Tasks & Orbit',
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'Task title' },
          dueTime: { type: Type.STRING, description: 'Due date/time description' },
          priority: { type: Type.STRING, description: '"low", "medium", or "high"' },
        },
        required: ['title'],
      },
    },
    {
      name: 'search_tasks',
      description: 'Search user tasks and their completion status',
      parameters: {
        type: Type.OBJECT,
        properties: {
          status: { type: Type.STRING, description: '"all", "pending", or "completed"' },
          query: { type: Type.STRING, description: 'Title search query' },
        },
      },
    },
    {
      name: 'complete_task',
      description: 'Mark a task as completed',
      parameters: {
        type: Type.OBJECT,
        properties: {
          taskId: { type: Type.STRING, description: 'Task ID to mark complete' },
        },
        required: ['taskId'],
      },
    },

    // 8. GOOGLE CHAT
    {
      name: 'list_chat_spaces',
      description: 'List user joined Google Chat spaces and channels',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: 'Filter spaces by name' },
        },
      },
    },
    {
      name: 'get_chat_messages',
      description: 'Read recent messages from a Google Chat space',
      parameters: {
        type: Type.OBJECT,
        properties: {
          spaceName: { type: Type.STRING, description: 'Name of the Chat space' },
          maxMessages: { type: Type.NUMBER, description: 'Number of messages to retrieve' },
        },
        required: ['spaceName'],
      },
    },

    // 9. GOOGLE FORMS
    {
      name: 'list_forms',
      description: 'List Google Forms surveys and summarize response metrics',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: 'Form title or keyword' },
        },
      },
    },

    // 10. GOOGLE KEEP
    {
      name: 'search_keep_notes',
      description: 'Search user personal notes and ideas from Google Keep',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: 'Search term' },
        },
        required: ['query'],
      },
    },
    {
      name: 'create_keep_note',
      description: 'Save a quick idea or note to Google Keep',
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'Note title' },
          content: { type: Type.STRING, description: 'Note text' },
        },
        required: ['title', 'content'],
      },
    },

    // 11. GOOGLE MEET
    {
      name: 'create_meet_link',
      description: 'Create an instant Google Meet video conference link for a meeting',
      parameters: {
        type: Type.OBJECT,
        properties: {
          meetingTopic: { type: Type.STRING, description: 'Topic or title of the meeting' },
        },
        required: ['meetingTopic'],
      },
    },

    // 12. CONTACTS
    {
      name: 'search_google_contacts',
      description: 'Look up people, email addresses, and phone numbers in Google Contacts',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: 'Name, company, or email to search' },
        },
        required: ['query'],
      },
    },

    // 13. GOOGLE CLASSROOM
    {
      name: 'list_classroom_courses',
      description: 'List Google Classroom courses, announcements, and assignments',
      parameters: {
        type: Type.OBJECT,
        properties: {
          status: { type: Type.STRING, description: '"ACTIVE" or "ARCHIVED"' },
        },
      },
    },

    // 14. GOOGLE MAPS PLATFORM
    {
      name: 'search_maps_places',
      description: 'Search places, restaurants, offices, addresses, and ratings using Google Maps Platform',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: 'Place name, address, or type (e.g. "coffee shop near financial district")' },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_maps_directions',
      description: 'Get estimated route, duration, and transit directions between two locations using Google Maps',
      parameters: {
        type: Type.OBJECT,
        properties: {
          origin: { type: Type.STRING, description: 'Starting address or landmark' },
          destination: { type: Type.STRING, description: 'Destination address or landmark' },
          mode: { type: Type.STRING, description: '"driving", "walking", "transit", or "bicycling"' },
        },
        required: ['origin', 'destination'],
      },
    },

    // 15. ORBIT LONG-TERM MEMORY
    {
      name: 'search_memory',
      description: 'Search long-term memory, personal preferences, and saved user context',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: 'Query string to match stored context or rules' },
        },
        required: ['query'],
      },
    },
    {
      name: 'save_memory',
      description: 'Store a permanent preference, rule, or fact about user for future AI responses',
      parameters: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING, description: 'The preference or fact to record' },
          type: { type: Type.STRING, description: '"preference", "work_context", or "instruction"' },
        },
        required: ['content'],
      },
    },
  ],
};

// Tool Execution Dispatcher
export async function executeToolCall(
  userId: string,
  toolName: string,
  args: Record<string, any>
): Promise<{ result: any; requiresConfirmation?: boolean }> {
  const integrations = db.getUserIntegrations(userId);
  const isConnected = (svc: string) => integrations.some(i => (i.service === svc || i.service.includes(svc)) && i.status === 'connected');

  switch (toolName) {
    // Gmail
    case 'search_gmail': {
      return {
        result: {
          status: 'success',
          query: args.query,
          messages: [
            {
              id: 'msg_em_101',
              sender: 'Sarah Chen <sarah.chen@acme.corp>',
              subject: 'Q3 Product Strategy & Roadmap Deck',
              snippet: 'Hi, please find attached the revised roadmap for our product launch. Let me know your thoughts before tomorrow.',
              date: 'Yesterday, 4:15 PM',
              hasAttachments: true,
            },
            {
              id: 'msg_em_102',
              sender: 'John Miller <j.miller@cloudventures.io>',
              subject: 'Follow-up on Partnership Agreement',
              snippet: 'Great speaking with you last week. Could we finalize the partnership terms and schedule a brief review?',
              date: 'Sep 17, 2026, 11:30 AM',
              hasAttachments: false,
            },
            {
              id: 'msg_em_103',
              sender: 'Alex Rivera <alex.rivera@designlab.co>',
              subject: 'Updated UI Assets for Orbit Assistant',
              snippet: 'Hey! Uploaded the refined SVG vector assets and typography specs to Drive for the team.',
              date: 'Sep 16, 2026, 9:20 AM',
              hasAttachments: true,
            },
          ].filter(m => {
            const q = (args.query || '').toLowerCase();
            return !q || m.subject.toLowerCase().includes(q) || m.sender.toLowerCase().includes(q) || m.snippet.toLowerCase().includes(q);
          }),
        },
      };
    }

    case 'get_email': {
      return {
        result: {
          id: args.emailId,
          from: 'Sarah Chen <sarah.chen@acme.corp>',
          to: 'me',
          subject: 'Q3 Product Strategy & Roadmap Deck',
          date: 'Yesterday, 4:15 PM',
          body: 'Hi Alex,\n\nFollowing up on our sprint review, attached is the Q3 Strategy deck. The executive summary highlights our AI-first workflows and integration milestones. Please review section 3 regarding security clearance before our sync.\n\nBest,\nSarah',
          attachments: ['Q3_Strategy_Deck_v2.pdf'],
        },
      };
    }

    case 'draft_email': {
      return {
        result: {
          status: 'draft_created',
          draftId: `draft_${Date.now()}`,
          to: args.to,
          subject: args.subject,
          body: args.body,
          message: `Draft successfully created in your Gmail client for ${args.to}.`,
        },
      };
    }

    case 'send_email': {
      if (!args.confirmed) {
        return {
          requiresConfirmation: true,
          result: {
            status: 'awaiting_confirmation',
            to: args.to,
            subject: args.subject,
            body: args.body,
            message: `Orbit is ready to send this email to ${args.to}. Please confirm before proceeding.`,
          },
        };
      }
      return {
        result: {
          status: 'sent',
          messageId: `sent_${Date.now()}`,
          to: args.to,
          subject: args.subject,
          sentAt: new Date().toISOString(),
          message: `Email successfully sent to ${args.to}.`,
        },
      };
    }

    // Google Calendar
    case 'search_calendar': {
      return {
        result: {
          status: 'success',
          events: [
            {
              id: 'cal_ev_201',
              title: 'Product Sync & Orbit Review',
              start: 'Today at 10:00 AM',
              end: 'Today at 10:45 AM',
              attendees: ['sarah.chen@acme.corp', 'john.miller@cloudventures.io'],
              location: 'Google Meet (https://meet.google.com/xyz-orb-ai)',
            },
            {
              id: 'cal_ev_202',
              title: 'Architecture & Security Architecture',
              start: 'Today at 4:30 PM',
              end: 'Today at 5:15 PM',
              attendees: ['security-lead@orbit.ai'],
              location: 'Conference Room B',
            },
            {
              id: 'cal_ev_203',
              title: 'Sprint Planning',
              start: 'Tomorrow at 11:00 AM',
              end: 'Tomorrow at 12:00 PM',
              attendees: ['engineering-team@orbit.ai'],
              location: 'Google Meet',
            },
          ],
        },
      };
    }

    case 'create_calendar_event': {
      const meetLink = args.addMeetLink !== false ? `https://meet.google.com/${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 6)}` : undefined;
      const event = {
        id: `ev_${Date.now()}`,
        title: args.title,
        startTime: args.startTime,
        endTime: args.endTime || '1 hour later',
        attendees: args.attendees || [],
        description: args.description || '',
        meetLink,
      };
      return {
        result: {
          status: 'created',
          event,
          message: `Calendar event "${args.title}" scheduled for ${args.startTime}.${meetLink ? ` Meet link generated: ${meetLink}` : ''}`,
        },
      };
    }

    // Google Drive
    case 'search_drive': {
      return {
        result: {
          status: 'success',
          files: [
            {
              id: 'file_drv_301',
              name: 'Q3 Product Strategy & Roadmap Deck.pdf',
              type: 'pdf',
              lastModified: 'Yesterday by Sarah Chen',
              url: 'https://drive.google.com/file/d/sample301',
            },
            {
              id: 'file_drv_302',
              name: 'Orbit AI API Specifications & Architecture.gdoc',
              type: 'document',
              lastModified: '3 days ago by You',
              url: 'https://docs.google.com/document/d/sample302',
            },
            {
              id: 'file_drv_303',
              name: '2026 Customer Feedback & Feature Requests.gsheet',
              type: 'spreadsheet',
              lastModified: 'Sep 15, 2026',
              url: 'https://docs.google.com/spreadsheets/d/sample303',
            },
            {
              id: 'file_drv_304',
              name: 'Q3 Board Presentation.gslides',
              type: 'presentation',
              lastModified: 'Sep 14, 2026 by Marketing',
              url: 'https://docs.google.com/presentation/d/sample304',
            },
          ].filter(f => {
            const q = (args.query || '').toLowerCase();
            return !q || f.name.toLowerCase().includes(q);
          }),
        },
      };
    }

    case 'get_drive_file': {
      return {
        result: {
          id: args.fileId,
          title: 'Q3 Product Strategy & Roadmap Deck.pdf',
          summary: 'Document outlines the launch trajectory for Orbit AI. Key focal points: zero-latency context retrieval, multi-app tool orchestration, and rigorous user privacy controls.',
          owner: 'Sarah Chen',
        },
      };
    }

    // Google Sheets
    case 'read_google_sheet': {
      return {
        result: {
          status: 'success',
          spreadsheetId: args.spreadsheetId,
          title: '2026 Financial Forecast & Metrics',
          headers: ['Metric', 'Q1 Actual', 'Q2 Actual', 'Q3 Target', 'Status'],
          rows: [
            ['Active Organizations', '1,240', '3,480', '6,000', 'On Track'],
            ['API Queries Processed', '4.2M', '12.8M', '25M', 'Exceeding'],
            ['Retention Rate', '94.2%', '95.1%', '96.0%', 'Healthy'],
            ['Average Response Latency', '420ms', '280ms', '200ms', 'Improving'],
          ],
        },
      };
    }

    case 'update_google_sheet': {
      return {
        result: {
          status: 'success',
          spreadsheetId: args.spreadsheetId,
          updatedRows: args.values.length,
          message: `Successfully appended ${args.values.length} rows to spreadsheet.`,
        },
      };
    }

    // Google Docs
    case 'read_google_doc': {
      return {
        result: {
          status: 'success',
          docId: args.docId,
          title: 'Orbit AI Technical Blueprint',
          content: '# Orbit AI System Architecture\n\nOrbit AI functions as a personal intelligence layer. It maintains scoped tokens for Gmail, Calendar, Drive, Sheets, Docs, Tasks, Meet, and Chat.\n\n### Key Principles\n1. Deterministic tool verification.\n2. Streaming token pipeline with Gemini Flash.\n3. Transparent confirmation for consequential actions.',
        },
      };
    }

    case 'create_google_doc': {
      return {
        result: {
          status: 'created',
          docId: `doc_${Date.now()}`,
          title: args.title,
          url: `https://docs.google.com/document/d/doc_${Date.now()}`,
          message: `Google Document "${args.title}" created successfully.`,
        },
      };
    }

    // Google Slides
    case 'search_google_slides': {
      return {
        result: {
          status: 'success',
          presentations: [
            {
              id: 'slide_401',
              title: 'Executive Keynote — Autumn 2026',
              slideCount: 24,
              lastModified: 'Sep 12, 2026',
              url: 'https://docs.google.com/presentation/d/slide_401',
            },
            {
              id: 'slide_402',
              title: 'Product Design System & Typography Guidelines',
              slideCount: 16,
              lastModified: 'Aug 28, 2026',
              url: 'https://docs.google.com/presentation/d/slide_402',
            },
          ],
        },
      };
    }

    // Google Tasks
    case 'create_task': {
      const newTask = db.addTask({
        id: `tsk_${Date.now()}`,
        userId,
        title: args.title,
        dueTime: args.dueTime || 'Today',
        status: 'pending',
        source: 'orbit_ai',
        priority: (args.priority as any) || 'medium',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return {
        result: {
          status: 'task_created',
          task: newTask,
          message: `Task "${newTask.title}" added to your Google Tasks and Orbit list.`,
        },
      };
    }

    case 'search_tasks': {
      const allTasks = db.getUserTasks(userId);
      const filtered = allTasks.filter(t => {
        if (args.status && args.status !== 'all' && t.status !== args.status) return false;
        if (args.query && !t.title.toLowerCase().includes(args.query.toLowerCase())) return false;
        return true;
      });
      return {
        result: {
          status: 'success',
          tasks: filtered,
        },
      };
    }

    case 'complete_task': {
      const updated = db.updateTask(userId, args.taskId, { status: 'completed' });
      return {
        result: {
          status: 'success',
          task: updated,
          message: `Task marked as completed.`,
        },
      };
    }

    // Google Chat
    case 'list_chat_spaces': {
      return {
        result: {
          status: 'success',
          spaces: [
            { id: 'space_dev', name: 'Product Engineering', membersCount: 18, unread: 2 },
            { id: 'space_general', name: 'General Announcements', membersCount: 65, unread: 0 },
            { id: 'space_leadership', name: 'Executive Strategy', membersCount: 7, unread: 1 },
          ],
        },
      };
    }

    case 'get_chat_messages': {
      return {
        result: {
          status: 'success',
          spaceName: args.spaceName,
          messages: [
            { sender: 'David Liu', time: '9:15 AM', text: 'Deployment for v2.4 staging went through cleanly.' },
            { sender: 'Maria Santos', time: '9:40 AM', text: 'Great work team! QA has signed off on the new search indices.' },
          ],
        },
      };
    }

    // Google Forms
    case 'list_forms': {
      return {
        result: {
          status: 'success',
          forms: [
            { id: 'form_501', title: 'Q3 Customer Satisfaction Survey', responseCount: 142, status: 'Accepting responses' },
            { id: 'form_502', title: 'Annual Employee Wellness & Feedback', responseCount: 58, status: 'Accepting responses' },
          ],
        },
      };
    }

    // Google Keep
    case 'search_keep_notes': {
      return {
        result: {
          status: 'success',
          notes: [
            { id: 'keep_601', title: 'Ideas for Orbit Voice Pipeline', snippet: 'Look into whisper web workers and local audio buffer streaming.' },
            { id: 'keep_602', title: 'Books to Read', snippet: 'Designing Data-Intensive Applications, The Design of Everyday Things.' },
          ],
        },
      };
    }

    case 'create_keep_note': {
      return {
        result: {
          status: 'created',
          note: { id: `keep_${Date.now()}`, title: args.title, snippet: args.content },
          message: `Note "${args.title}" saved to Google Keep.`,
        },
      };
    }

    // Google Meet
    case 'create_meet_link': {
      const code = `${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`;
      const link = `https://meet.google.com/${code}`;
      return {
        result: {
          status: 'created',
          meetLink: link,
          topic: args.meetingTopic,
          message: `Google Meet link generated for "${args.meetingTopic}": ${link}`,
        },
      };
    }

    // Google Contacts
    case 'search_google_contacts': {
      return {
        result: {
          status: 'success',
          contacts: [
            { name: 'Sarah Chen', email: 'sarah.chen@acme.corp', role: 'Head of Product', phone: '+1 (415) 555-0142' },
            { name: 'John Miller', email: 'j.miller@cloudventures.io', role: 'General Partner', phone: '+1 (650) 555-0198' },
            { name: 'Alex Rivera', email: 'alex.rivera@designlab.co', role: 'Design Lead', phone: '+1 (212) 555-0115' },
          ].filter(c => {
            const q = (args.query || '').toLowerCase();
            return !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.role.toLowerCase().includes(q);
          }),
        },
      };
    }

    // Google Classroom
    case 'list_classroom_courses': {
      return {
        result: {
          status: 'success',
          courses: [
            { id: 'crs_801', name: 'Advanced Machine Learning & Neural Nets', section: 'CS 498', room: 'Hall 3' },
            { id: 'crs_802', name: 'Distributed Systems & Cloud Computing', section: 'CS 425', room: 'Virtual' },
          ],
        },
      };
    }

    // Google Maps Platform
    case 'search_maps_places': {
      return {
        result: {
          status: 'success',
          query: args.query,
          places: [
            {
              name: 'Blue Bottle Coffee',
              address: '315 Linden St, San Francisco, CA 94102',
              rating: 4.6,
              reviewsCount: 1420,
              openNow: true,
              type: 'Cafe / Coffee shop',
            },
            {
              name: 'Sightglass Coffee',
              address: '270 7th St, San Francisco, CA 94103',
              rating: 4.7,
              reviewsCount: 2310,
              openNow: true,
              type: 'Artisan Coffee Roaster',
            },
          ],
        },
      };
    }

    case 'get_maps_directions': {
      return {
        result: {
          status: 'success',
          origin: args.origin,
          destination: args.destination,
          mode: args.mode || 'driving',
          distance: '4.8 miles',
          duration: '14 mins',
          summary: 'Fastest route via US-101 S with standard traffic flow.',
        },
      };
    }

    // Memory
    case 'search_memory': {
      const memories = db.getUserMemories(userId);
      const q = (args.query || '').toLowerCase();
      const matched = memories.filter(m => m.content.toLowerCase().includes(q));
      return {
        result: {
          status: 'success',
          memories: matched.length > 0 ? matched : memories.slice(0, 5),
        },
      };
    }

    case 'save_memory': {
      const mem: MemoryItem = {
        id: `mem_${Date.now()}`,
        userId,
        source: 'conversation',
        type: (args.type as any) || 'preference',
        content: args.content,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.addMemory(mem);
      return {
        result: {
          status: 'saved',
          memory: mem,
          message: `Remembered: "${args.content}"`,
        },
      };
    }

    default:
      return {
        result: { error: `Unknown tool: ${toolName}` },
      };
  }
}

// Generate concise title for conversation
export async function generateChatTitle(firstMessage: string): Promise<string> {
  try {
    const ai = getAiClient();
    const prompt = `Generate a concise, clean, and professional title (2 to 5 words maximum, no quotes, no punctuation) for an AI conversation starting with: "${firstMessage.slice(0, 300)}".`;
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });
    const text = response.text ? response.text.trim().replace(/^["']|["']$/g, '') : '';
    return text.slice(0, 45) || 'Productive Discussion';
  } catch (err) {
    console.warn('Failed to auto-generate title with Gemini, using fallback:', err);
    return firstMessage.slice(0, 30).trim() || 'New Chat';
  }
}

// Stream Gemini AI response with tools
export async function streamChatResponse(
  userId: string,
  conversationId: string,
  userMessage: string,
  attachments: any[] = [],
  onChunk: (chunk: { type: 'text' | 'tool_call' | 'tool_result' | 'done'; content?: string; payload?: any }) => void
): Promise<string> {
  const ai = getAiClient();
  const user = db.getUserById(userId);
  const userSettings = db.getUserSettings(userId);
  const integrations = db.getUserIntegrations(userId);
  const memories = db.getUserMemories(userId);
  const tasks = db.getUserTasks(userId);
  const history = db.getMessages(conversationId).slice(-10);

  const connectedServicesList = integrations
    .filter(i => i.status === 'connected')
    .map(i => `${i.name} (${i.service})`)
    .join(', ') || 'All standard Google Workspace and productivity tools available';

  const relevantMemories = memories
    .slice(0, 8)
    .map(m => `- ${m.content} [${m.type}]`)
    .join('\n') || 'None recorded yet';

  const currentTasks = tasks
    .filter(t => t.status !== 'completed')
    .slice(0, 6)
    .map(t => `- [${t.priority}] ${t.title} (Due: ${t.dueTime || 'unspecified'})`)
    .join('\n') || 'No pending tasks';

  const systemInstruction = `You are Orbit AI, the intelligent, unified productivity assistant in orbit around everything the user does.
The user's name is ${user?.callName || user?.firstName || 'User'}.
User preferences: ${userSettings.responsePreferences}.

Context Information:
- Current Date/Time: ${new Date().toLocaleString()}
- Connected Productivity Services: ${connectedServicesList}
- Active User Memories & Preferences:
${relevantMemories}
- Current Active Tasks:
${currentTasks}

Core Behavior Guidelines:
1. You work directly with the user's connected apps, information, files, and tasks.
2. Proactively use tools whenever the user asks about emails, calendar, drive files, sheets, docs, slides, tasks, contacts, chat, forms, notes, or maps.
3. Consequential actions (like actually sending an email or deleting events) require explicit user confirmation. When drafting or creating items, present the parameters clearly.
4. Format your responses with clean, readable Markdown: bold headings, bulleted lists, and structured summaries. Keep tone calm, intelligent, proactive, and sophisticated.`;

  const contents: any[] = [];

  for (const msg of history) {
    if (msg.role === 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: msg.content }],
      });
    } else if (msg.role === 'assistant') {
      contents.push({
        role: 'model',
        parts: [{ text: msg.content || ' ' }],
      });
    }
  }

  let currentContent = userMessage;
  if (attachments && attachments.length > 0) {
    currentContent += `\n\n[Attached files: ${attachments.map(a => `${a.name} (${a.mimeType})`).join(', ')}]`;
  }

  contents.push({
    role: 'user',
    parts: [{ text: currentContent }],
  });

  let fullResponseText = '';
  let continueCalling = true;
  let iterations = 0;

  while (continueCalling && iterations < 6) {
    iterations++;

    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction,
        tools: [tools],
      },
    });

    let iterationToolCalls: any[] = [];
    let iterationText = '';

    for await (const chunk of responseStream) {
      if (chunk.functionCalls && chunk.functionCalls.length > 0) {
        for (const call of chunk.functionCalls) {
          iterationToolCalls.push(call);
          onChunk({
            type: 'tool_call',
            payload: {
              id: `call_${Date.now()}_${call.name}`,
              name: call.name,
              arguments: call.args,
            },
          });
        }
      }

      const chunkText = chunk.text;
      if (chunkText) {
        iterationText += chunkText;
        fullResponseText += chunkText;
        onChunk({
          type: 'text',
          content: chunkText,
        });
      }
    }

    if (iterationToolCalls.length > 0) {
      const functionResponseParts: any[] = [];

      for (const call of iterationToolCalls) {
        const { result, requiresConfirmation } = await executeToolCall(
          userId,
          call.name,
          call.args as Record<string, any>
        );

        onChunk({
          type: 'tool_result',
          payload: {
            name: call.name,
            result,
            requiresConfirmation,
          },
        });

        functionResponseParts.push({
          functionResponse: {
            name: call.name,
            response: result,
          },
        });
      }

      contents.push({
        role: 'model',
        parts: iterationToolCalls.map(c => ({
          functionCall: {
            name: c.name,
            args: c.args,
          },
        })),
      });

      contents.push({
        role: 'user',
        parts: functionResponseParts,
      });
    } else {
      continueCalling = false;
    }
  }

  onChunk({
    type: 'done',
    content: fullResponseText,
  });

  return fullResponseText;
}
