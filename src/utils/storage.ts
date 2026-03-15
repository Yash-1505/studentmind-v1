import type { AppSettings, Session } from "../types";

const KEYS = {
  SETTINGS: "studentmind_settings",
  SESSIONS: "studentmind_sessions",
  CURRENT_SESSION: "studentmind_current_session",
} as const;

const MAX_SESSIONS = 30;

// ─── Settings ─────────────────────────────────────────────────────────────────

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.warn("Failed to save settings:", e);
  }
}

export function loadSettings(): Partial<AppSettings> {
  try {
    const raw = localStorage.getItem(KEYS.SETTINGS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function saveSessions(sessions: Session[]): void {
  try {
    // Keep only the most recent MAX_SESSIONS
    const trimmed = sessions.slice(-MAX_SESSIONS);
    localStorage.setItem(KEYS.SESSIONS, JSON.stringify(trimmed));
  } catch (e) {
    console.warn("Failed to save sessions:", e);
  }
}

export function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(KEYS.SESSIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCurrentSessionId(id: string): void {
  try {
    localStorage.setItem(KEYS.CURRENT_SESSION, id);
  } catch {}
}

export function loadCurrentSessionId(): string | null {
  return localStorage.getItem(KEYS.CURRENT_SESSION);
}

export function deleteSession(sessions: Session[], id: string): Session[] {
  return sessions.filter(s => s.id !== id);
}

export function clearAll(): void {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}
