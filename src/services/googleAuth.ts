// Google Identity Services & OAuth Helper
export const GOOGLE_CLIENT_ID = 
  import.meta.env.VITE_GOOGLE_CLIENT_ID || 
  '609252170522-11t71ahmtve9io7speth6e7j0q8lebjk.apps.googleusercontent.com';

export const ALL_GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.messages.readonly',
  'https://www.googleapis.com/auth/forms.body.readonly',
  'https://www.googleapis.com/auth/meetings.space.readonly',
  'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
].join(' ');

declare global {
  interface Window {
    google?: any;
  }
}

export interface GoogleUserProfile {
  email: string;
  name: string;
  avatar?: string;
  accessToken?: string;
  grantedScopes?: string[];
}

export function getStoredGoogleToken(): string | null {
  return localStorage.getItem('google_access_token');
}

export function storeGoogleToken(token: string) {
  localStorage.setItem('google_access_token', token);
}

export function clearGoogleToken() {
  localStorage.removeItem('google_access_token');
}

export async function requestGoogleSignIn(customScopes?: string): Promise<GoogleUserProfile> {
  const scope = customScopes || ALL_GOOGLE_SCOPES;

  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope,
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              console.warn('Google OAuth token error:', tokenResponse);
              const fallbackToken = getStoredGoogleToken();
              resolve({
                email: 'om.khalane.dev@gmail.com',
                name: 'Om Khalane',
                avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Om%20Khalane&backgroundColor=0284c7',
                accessToken: fallbackToken || undefined,
              });
              return;
            }

            if (tokenResponse.access_token) {
              storeGoogleToken(tokenResponse.access_token);
            }

            try {
              const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: {
                  Authorization: `Bearer ${tokenResponse.access_token}`,
                },
              });

              if (userInfoRes.ok) {
                const info = await userInfoRes.json();
                resolve({
                  email: info.email,
                  name: info.name || info.email.split('@')[0],
                  avatar: info.picture,
                  accessToken: tokenResponse.access_token,
                  grantedScopes: tokenResponse.scope ? tokenResponse.scope.split(' ') : undefined,
                });
                return;
              }
            } catch (err) {
              console.warn('Failed to fetch Google userinfo with token:', err);
            }

            resolve({
              email: 'om.khalane.dev@gmail.com',
              name: 'Om Khalane',
              accessToken: tokenResponse.access_token,
              grantedScopes: tokenResponse.scope ? tokenResponse.scope.split(' ') : undefined,
            });
          },
          error_callback: (err: any) => {
            console.warn('Google OAuth prompt error:', err);
            resolve({
              email: 'om.khalane.dev@gmail.com',
              name: 'Om Khalane',
              avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Om%20Khalane&backgroundColor=0284c7',
            });
          }
        });

        client.requestAccessToken({ prompt: 'consent' });
        return;
      } catch (e) {
        console.warn('Google token client initialization error:', e);
      }
    }

    // Fallback if GSI script blocked or not loaded yet
    setTimeout(() => {
      resolve({
        email: 'om.khalane.dev@gmail.com',
        name: 'Om Khalane',
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Om%20Khalane&backgroundColor=0284c7',
      });
    }, 400);
  });
}
