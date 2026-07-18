export type GoogleSyncStatus = "not-synced" | "pending" | "synced" | "error";

export type CalendarMemo = {
  title: string;
  description?: string;
  scheduleDate: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
};

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleTokenClient = {
  callback: (response: GoogleTokenResponse) => void;
  requestAccessToken: (options?: { prompt?: string }) => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
          }) => GoogleTokenClient;
          revoke: (token: string, callback?: () => void) => void;
        };
      };
    };
  }
}

const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

let scriptPromise: Promise<void> | null = null;
let accessToken: string | null = null;

export function isGoogleCalendarConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
}

export function isGoogleCalendarConnected() {
  return Boolean(accessToken);
}

export function loadGoogleIdentityServices(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Calendar connection is only available in the browser."));
  }

  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_IDENTITY_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google sign-in script could not be loaded.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_IDENTITY_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google sign-in script could not be loaded."));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export async function connectGoogleCalendar(): Promise<void> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured.");

  await loadGoogleIdentityServices();
  if (!window.google?.accounts?.oauth2) throw new Error("Google Identity Services is unavailable.");

  await new Promise<void>((resolve, reject) => {
    const tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: CALENDAR_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description || response.error || "Google Calendar connection failed."));
          return;
        }
        accessToken = response.access_token;
        resolve();
      },
    });

    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

export function disconnectGoogleCalendar() {
  if (accessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(accessToken);
  }
  accessToken = null;
}

function requireAccessToken() {
  if (!accessToken) throw new Error("Google Calendar is not connected.");
  return accessToken;
}

function toGoogleEvent(memo: CalendarMemo) {
  if (!memo.scheduleDate) throw new Error("A date is required before syncing to Google Calendar.");

  const base = {
    summary: memo.title,
    description: memo.description || undefined,
  };

  if (memo.allDay || !memo.startTime) {
    const endDate = new Date(`${memo.scheduleDate}T00:00:00`);
    endDate.setDate(endDate.getDate() + 1);
    const nextDay = [endDate.getFullYear(), String(endDate.getMonth() + 1).padStart(2, "0"), String(endDate.getDate()).padStart(2, "0")].join("-");
    return { ...base, start: { date: memo.scheduleDate }, end: { date: nextDay } };
  }

  const endTime = memo.endTime || memo.startTime;
  return {
    ...base,
    start: { dateTime: `${memo.scheduleDate}T${memo.startTime}:00`, timeZone: "Asia/Tokyo" },
    end: { dateTime: `${memo.scheduleDate}T${endTime}:00`, timeZone: "Asia/Tokyo" },
  };
}

async function calendarRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${CALENDAR_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireAccessToken()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    if (response.status === 401) accessToken = null;
    throw new Error(detail?.error?.message || `Google Calendar request failed (${response.status}).`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function createGoogleCalendarEvent(memo: CalendarMemo, calendarId = "primary") {
  return calendarRequest<{ id: string; htmlLink?: string }>(`/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    body: JSON.stringify(toGoogleEvent(memo)),
  });
}

export async function updateGoogleCalendarEvent(eventId: string, memo: CalendarMemo, calendarId = "primary") {
  return calendarRequest<{ id: string; htmlLink?: string }>(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: JSON.stringify(toGoogleEvent(memo)),
  });
}

export async function deleteGoogleCalendarEvent(eventId: string, calendarId = "primary") {
  return calendarRequest<void>(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
  });
}
