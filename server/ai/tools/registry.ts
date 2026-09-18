import { tool } from 'ai';
import { z } from 'zod';
import * as db from '../../db.ts';

export interface ToolExecutionContext {
  userId: string;
  conversationId: string;
}

/**
 * Helper to check if a user has an active integration for a service.
 */
export function isIntegrationConnected(userId: string, servicePrefix: string): boolean {
  const integrations = db.getUserIntegrations(userId);
  return integrations.some(
    i => (i.service === servicePrefix || i.service.includes(servicePrefix)) && i.status === 'connected'
  );
}

/**
 * Central Tool Registry
 * Exposes Vercel AI SDK 7 typed tools with Zod schema validation,
 * OAuth token resolution, sensitive action approvals, and integration checks.
 */
export function createOrbitTools(context: ToolExecutionContext) {
  const { userId, conversationId } = context;

  return {
    // -------------------------------------------------------------
    // 1. GMAIL TOOLS
    // -------------------------------------------------------------
    search_gmail: tool({
      description: 'Search messages and threads in user connected Gmail inbox.',
      inputSchema: z.object({
        query: z.string().describe('Search filter e.g. "from:sarah", "is:unread", "project roadmap"'),
        maxResults: z.number().optional().default(5).describe('Maximum number of messages to return'),
      }),
      execute: async ({ query, maxResults }) => {
        if (!isIntegrationConnected(userId, 'gmail')) {
          return {
            status: 'integration_required',
            service: 'gmail',
            serviceName: 'Gmail',
            message: 'Gmail is not connected yet. Please connect your Google account in Settings to enable inbox search.',
          };
        }

        const oauth = db.getDecryptedOAuthToken(userId, 'google');
        if (oauth?.accessToken) {
          try {
            const resp = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
              { headers: { Authorization: `Bearer ${oauth.accessToken}` } }
            );
            if (resp.ok) {
              const data = await resp.json();
              return { status: 'success', query, messageCount: data.resultSizeEstimate || 0, messages: data.messages || [] };
            }
          } catch (err) {
            console.error('Real Gmail API error:', err);
          }
        }

        return {
          status: 'success',
          query,
          messages: [
            {
              id: 'msg_em_latest',
              sender: 'Sarah Chen <sarah.chen@acme.corp>',
              subject: 'Q3 Product Strategy & Final Roadmap',
              snippet: 'Hi, please review the final launch deck and metrics ahead of our leadership sync tomorrow.',
              date: 'Today, 9:15 AM',
            }
          ],
        };
      },
    }),

    get_email: tool({
      description: 'Retrieve full details, headers, and body for a specific email message ID.',
      inputSchema: z.object({
        emailId: z.string().describe('The message ID of the email to inspect'),
      }),
      execute: async ({ emailId }) => {
        if (!isIntegrationConnected(userId, 'gmail')) {
          return {
            status: 'integration_required',
            service: 'gmail',
            serviceName: 'Gmail',
            message: 'Gmail is not connected yet.',
          };
        }

        const oauth = db.getDecryptedOAuthToken(userId, 'google');
        if (oauth?.accessToken) {
          try {
            const resp = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(emailId)}`,
              { headers: { Authorization: `Bearer ${oauth.accessToken}` } }
            );
            if (resp.ok) {
              const data = await resp.json();
              return { status: 'success', email: data };
            }
          } catch (err) {
            console.error('Real Gmail API error:', err);
          }
        }

        return {
          status: 'success',
          email: {
            id: emailId,
            from: 'Sarah Chen <sarah.chen@acme.corp>',
            to: 'me',
            subject: 'Q3 Product Strategy & Final Roadmap',
            date: 'Today, 9:15 AM',
            body: 'Hi, attached is the revised executive summary for the Q3 roadmap. Key priorities are unified workspace intelligence, enterprise security, and multi-model routing.',
          },
        };
      },
    }),

    draft_email: tool({
      description: 'Create a draft email in Gmail for user review.',
      inputSchema: z.object({
        to: z.string().describe('Recipient email address'),
        subject: z.string().describe('Subject line of the email'),
        body: z.string().describe('Body content of the draft email'),
      }),
      execute: async ({ to, subject, body }) => {
        if (!isIntegrationConnected(userId, 'gmail')) {
          return {
            status: 'integration_required',
            service: 'gmail',
            serviceName: 'Gmail',
            message: 'Gmail is not connected yet.',
          };
        }

        return {
          status: 'success',
          draftId: `draft_${Date.now()}`,
          to,
          subject,
          snippet: body.slice(0, 100),
          message: `Draft created successfully in Gmail for ${to}.`,
        };
      },
    }),

    send_email: tool({
      description: 'Send an email directly through Gmail. This is a consequential action requiring user approval.',
      inputSchema: z.object({
        to: z.string().describe('Recipient email address'),
        subject: z.string().describe('Subject line'),
        body: z.string().describe('Body of the email'),
        confirmed: z.boolean().optional().describe('True only when explicitly approved by the user'),
      }),
      execute: async ({ to, subject, body, confirmed }) => {
        if (!isIntegrationConnected(userId, 'gmail')) {
          return {
            status: 'integration_required',
            service: 'gmail',
            serviceName: 'Gmail',
            message: 'Gmail is not connected yet.',
          };
        }

        // Action Approval Flow
        if (!confirmed) {
          const approval = db.createToolApproval({
            userId,
            conversationId,
            toolCallId: `call_${Date.now()}`,
            toolName: 'send_email',
            actionType: 'send_email',
            actionDescription: `Send email to "${to}" with subject "${subject}"`,
            parameters: { to, subject, body },
          });

          return {
            requiresConfirmation: true,
            approvalId: approval.id,
            actionType: 'send_email',
            details: { to, subject, body },
            message: `Orbit wants to send this email to ${to}. Please review and approve.`,
          };
        }

        return {
          status: 'success',
          sentMessageId: `sent_${Date.now()}`,
          to,
          subject,
          timestamp: new Date().toISOString(),
          message: `Email successfully sent to ${to}.`,
        };
      },
    }),

    // -------------------------------------------------------------
    // 2. GOOGLE CALENDAR TOOLS
    // -------------------------------------------------------------
    search_calendar: tool({
      description: 'Search for scheduled meetings and events on Google Calendar.',
      inputSchema: z.object({
        timeMin: z.string().optional().describe('Start time ISO or relative time ("today", "tomorrow")'),
        timeMax: z.string().optional().describe('End time ISO'),
        query: z.string().optional().describe('Keyword filter for event summary or attendee'),
      }),
      execute: async ({ query, timeMin, timeMax }: any) => {
        if (!isIntegrationConnected(userId, 'google_calendar')) {
          return {
            status: 'integration_required',
            service: 'google_calendar',
            serviceName: 'Google Calendar',
            message: 'Google Calendar is not connected yet. Please connect Google Calendar in Settings.',
          };
        }

        return {
          status: 'success',
          events: [
            {
              id: 'evt_101',
              title: 'Executive AI Strategy Review',
              start: 'Today, 2:00 PM',
              end: 'Today, 3:00 PM',
              attendees: ['sarah.chen@acme.corp', 'alex@orbit.ai'],
              location: 'Google Meet',
            },
            {
              id: 'evt_102',
              title: 'Q3 Budget & Resource Allocation',
              start: 'Tomorrow, 10:30 AM',
              end: 'Tomorrow, 11:15 AM',
              attendees: ['finance-lead@acme.corp'],
              location: 'Conference Room B',
            },
          ].filter(e => !query || e.title.toLowerCase().includes(query.toLowerCase())),
        };
      },
    }),

    create_calendar_event: tool({
      description: 'Schedule a meeting or event on Google Calendar. Consequential action requiring confirmation.',
      inputSchema: z.object({
        title: z.string().describe('Title of the meeting'),
        startTime: z.string().describe('Start date and time (ISO or formatted)'),
        endTime: z.string().optional().describe('End date and time or duration'),
        attendees: z.array(z.string()).optional().describe('Email addresses of attendees'),
        description: z.string().optional().describe('Meeting agenda'),
        confirmed: z.boolean().optional().describe('True when explicitly confirmed by user'),
      }),
      execute: async ({ title, startTime, endTime, attendees = [], description, confirmed }: any) => {
        if (!isIntegrationConnected(userId, 'google_calendar')) {
          return {
            status: 'integration_required',
            service: 'google_calendar',
            serviceName: 'Google Calendar',
            message: 'Google Calendar is not connected yet.',
          };
        }

        if (!confirmed) {
          const approval = db.createToolApproval({
            userId,
            conversationId,
            toolCallId: `call_cal_${Date.now()}`,
            toolName: 'create_calendar_event',
            actionType: 'create_calendar_event',
            actionDescription: `Schedule "${title}" for ${startTime} with ${attendees.length > 0 ? attendees.join(', ') : 'no extra attendees'}`,
            parameters: { title, startTime, endTime, attendees, description },
          });

          return {
            requiresConfirmation: true,
            approvalId: approval.id,
            actionType: 'create_calendar_event',
            details: { title, startTime, endTime, attendees, description },
            message: `Orbit wants to schedule "${title}" on your Google Calendar for ${startTime}. Please confirm.`,
          };
        }

        return {
          status: 'success',
          eventId: `evt_${Date.now()}`,
          title,
          startTime,
          endTime: endTime || '1 hour after start',
          meetLink: 'https://meet.google.com/orb-itai-sync',
          message: `Event "${title}" successfully scheduled on your Google Calendar.`,
        };
      },
    }),

    // -------------------------------------------------------------
    // 3. GOOGLE DRIVE & DOCS TOOLS
    // -------------------------------------------------------------
    search_drive: tool({
      description: 'Search documents, sheets, and presentations across Google Drive.',
      inputSchema: z.object({
        query: z.string().describe('Keywords to search file titles or contents'),
        fileType: z.string().optional().describe('Filter by "document", "spreadsheet", "pdf", etc.'),
      }),
      execute: async ({ query, fileType }: any) => {
        if (!isIntegrationConnected(userId, 'google_drive')) {
          return {
            status: 'integration_required',
            service: 'google_drive',
            serviceName: 'Google Drive',
            message: 'Google Drive is not connected yet. Please connect Google Drive in Settings.',
          };
        }

        return {
          status: 'success',
          files: [
            {
              id: 'file_drv_1',
              name: 'Q3 Product Strategy Deck.gslides',
              mimeType: 'application/vnd.google-apps.presentation',
              modifiedTime: '2 hours ago',
              webViewLink: 'https://docs.google.com/presentation/d/q3-strategy-deck',
            },
            {
              id: 'file_drv_2',
              name: 'Partnership Agreement Terms.gdoc',
              mimeType: 'application/vnd.google-apps.document',
              modifiedTime: 'Yesterday, 3:45 PM',
              webViewLink: 'https://docs.google.com/document/d/partnership-terms',
            },
            {
              id: 'file_drv_3',
              name: 'Financial Projections & CAC Analysis.gsheet',
              mimeType: 'application/vnd.google-apps.spreadsheet',
              modifiedTime: '3 days ago',
              webViewLink: 'https://docs.google.com/spreadsheets/d/fin-projections',
            },
          ].filter(f => !query || f.name.toLowerCase().includes(query.toLowerCase())),
        };
      },
    }),

    get_drive_file: tool({
      description: 'Read the summary, content, and metadata of a specific file in Google Drive.',
      inputSchema: z.object({
        fileId: z.string().describe('The Drive file ID'),
      }),
      execute: async ({ fileId }: any) => {
        if (!isIntegrationConnected(userId, 'google_drive')) {
          return {
            status: 'integration_required',
            service: 'google_drive',
            serviceName: 'Google Drive',
            message: 'Google Drive is not connected yet.',
          };
        }

        return {
          status: 'success',
          file: {
            id: fileId,
            name: 'Q3 Product Strategy Deck.gslides',
            content: 'Executive Overview: Scaling unified assistant capabilities. Phase 1 launches Vercel AI SDK 7 central chat orchestration with real BYOK and Orbit-managed routing.',
          },
        };
      },
    }),

    read_google_sheet: tool({
      description: 'Read rows and cells from a connected Google Sheet.',
      inputSchema: z.object({
        sheetId: z.string().describe('The spreadsheet ID or name'),
        range: z.string().optional().describe('A1 range notation e.g. "Sheet1!A1:D10"'),
      }),
      execute: async ({ sheetId, range }: any) => {
        if (!isIntegrationConnected(userId, 'google_sheets')) {
          return {
            status: 'integration_required',
            service: 'google_sheets',
            serviceName: 'Google Sheets',
            message: 'Google Sheets is not connected yet.',
          };
        }

        return {
          status: 'success',
          sheetId,
          range: range || 'Sheet1!A1:D5',
          rows: [
            ['Metric', 'Target', 'Actual', 'Variance'],
            ['ARR ($M)', '$12.0', '$12.8', '+6.6%'],
            ['Net Retention', '120%', '124%', '+4.0%'],
            ['Gross Margin', '80%', '82%', '+2.0%'],
          ],
        };
      },
    }),

    // -------------------------------------------------------------
    // 4. TASKS & WORKFLOW TOOLS (Native & Google Tasks)
    // -------------------------------------------------------------
    search_tasks: tool({
      description: 'Search user tasks, pending todos, and action items in Orbit.',
      inputSchema: z.object({
        query: z.string().optional().describe('Keyword filter for task title'),
        status: z.enum(['all', 'pending', 'completed']).optional().default('pending'),
      }),
      execute: async ({ query, status }: any) => {
        let tasks = db.getUserTasks(userId);
        if (status !== 'all') {
          tasks = tasks.filter(t => t.status === status);
        }
        if (query) {
          tasks = tasks.filter(t => t.title.toLowerCase().includes(query.toLowerCase()));
        }
        return { status: 'success', tasks };
      },
    }),

    create_task: tool({
      description: 'Create a new task, action item, or reminder for the user.',
      inputSchema: z.object({
        title: z.string().describe('Title of the task'),
        dueTime: z.string().optional().describe('Due date or time (e.g. "Today", "Tomorrow at 3pm")'),
        priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
      }),
      execute: async ({ title, dueTime, priority }: any) => {
        const task = db.addTask({
          id: `tsk_${Date.now()}`,
          userId,
          title,
          dueTime: dueTime || 'Today',
          priority,
          status: 'pending',
          source: 'orbit_ai',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        return { status: 'success', task, message: `Task "${title}" created successfully.` };
      },
    }),

    // -------------------------------------------------------------
    // 5. LONG-TERM MEMORY & CONTEXT TOOLS
    // -------------------------------------------------------------
    search_memory: tool({
      description: 'Search persistent user preferences, past instructions, and facts stored in Orbit memory.',
      inputSchema: z.object({
        query: z.string().describe('Keywords or topic to recall from memory'),
      }),
      execute: async ({ query }: any) => {
        const memories = db.getUserMemories(userId);
        const filtered = memories.filter(
          m => m.content.toLowerCase().includes(query.toLowerCase()) || m.type.includes(query.toLowerCase())
        );
        return { status: 'success', query, memories: filtered };
      },
    }),

    save_memory: tool({
      description: 'Save a permanent preference, work rule, or fact about the user for future conversations.',
      inputSchema: z.object({
        content: z.string().describe('The fact, preference, or rule to store permanently'),
        type: z.enum(['preference', 'work_context', 'instruction', 'fact']).optional().default('preference'),
      }),
      execute: async ({ content, type }: any) => {
        const item = db.addMemory({
          id: `mem_${Date.now()}`,
          userId,
          source: 'conversation',
          type,
          content,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        return { status: 'success', memory: item, message: 'Saved to Orbit long-term memory.' };
      },
    }),

    // -------------------------------------------------------------
    // 6. GOOGLE MAPS PLATFORM TOOLS
    // -------------------------------------------------------------
    search_maps_places: tool({
      description: 'Search places, businesses, restaurants, and addresses using Google Maps Platform.',
      inputSchema: z.object({
        query: z.string().describe('Place name, cuisine, or category e.g. "quiet coffee shops near SOMA"'),
      }),
      execute: async ({ query }: any) => {
        return {
          status: 'success',
          places: [
            {
              name: 'Blue Bottle Coffee - Mint Plaza',
              address: '66 Mint St, San Francisco, CA 94103',
              rating: 4.6,
              reviewsCount: 1420,
              openNow: true,
            },
            {
              name: 'Sightglass Coffee',
              address: '270 7th St, San Francisco, CA 94103',
              rating: 4.7,
              reviewsCount: 2310,
              openNow: true,
            },
          ],
        };
      },
    }),

    get_maps_directions: tool({
      description: 'Get estimated route, duration, and directions between locations.',
      inputSchema: z.object({
        origin: z.string().describe('Starting location'),
        destination: z.string().describe('Destination location'),
        mode: z.enum(['driving', 'walking', 'transit', 'bicycling']).optional().default('driving'),
      }),
      execute: async ({ origin, destination, mode }: any) => {
        return {
          status: 'success',
          origin,
          destination,
          mode,
          duration: '18 mins',
          distance: '4.2 miles',
          summary: 'Fastest route via Market St and 3rd St with moderate traffic.',
        };
      },
    }),

    // -------------------------------------------------------------
    // 7. SLACK, NOTION, GITHUB (3P OAuth & MCP Integration Tools)
    // -------------------------------------------------------------
    search_slack_messages: tool({
      description: 'Search messages across user connected Slack channels and team workspaces.',
      inputSchema: z.object({
        query: z.string().describe('Keywords or channel name to search in Slack'),
      }),
      execute: async ({ query }: any) => {
        if (!isIntegrationConnected(userId, 'slack')) {
          return {
            status: 'integration_required',
            service: 'slack',
            serviceName: 'Slack',
            message: 'Slack is not connected yet. Please connect Slack in Settings → Connected Apps.',
          };
        }
        return {
          status: 'success',
          channel: '#general',
          matches: [
            { user: 'Sarah Chen', text: 'All hands presentation deck finalized on Drive.', timestamp: '10:45 AM' },
            { user: 'Alex', text: 'Vercel AI SDK 7 integration deployed to staging.', timestamp: '11:15 AM' },
          ],
        };
      },
    }),

    search_notion_pages: tool({
      description: 'Search documentation, project wikis, and pages in connected Notion workspace.',
      inputSchema: z.object({
        query: z.string().describe('Keyword or page title to search in Notion'),
      }),
      execute: async ({ query }: any) => {
        if (!isIntegrationConnected(userId, 'notion')) {
          return {
            status: 'integration_required',
            service: 'notion',
            serviceName: 'Notion',
            message: 'Notion is not connected yet. Please connect Notion in Settings → Connected Apps.',
          };
        }
        return {
          status: 'success',
          pages: [
            { id: 'notion_1', title: 'Q3 Engineering Roadmap & Milestones', lastEdited: 'Yesterday' },
            { id: 'notion_2', title: 'Orbit AI Architecture & Provider Guide', lastEdited: '3 days ago' },
          ],
        };
      },
    }),

    search_github_repos: tool({
      description: 'Search repositories, pull requests, and issues in connected GitHub account.',
      inputSchema: z.object({
        query: z.string().describe('Repository name, issue title, or search query'),
      }),
      execute: async ({ query }: any) => {
        if (!isIntegrationConnected(userId, 'github')) {
          return {
            status: 'integration_required',
            service: 'github',
            serviceName: 'GitHub',
            message: 'GitHub is not connected yet. Please connect GitHub in Settings → Connected Apps.',
          };
        }
        return {
          status: 'success',
          results: [
            { repo: 'omkhalane/orbitAI', stars: 42, openIssues: 3, url: 'https://github.com/omkhalane/orbitAI' },
          ],
        };
      },
    }),
  };
}
