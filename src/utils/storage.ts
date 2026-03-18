import type { AppSettings, Session, SourceFile, SavedNote } from "../types";

const KEYS = {
  SETTINGS: "studentmind_settings",
  SESSIONS: "studentmind_sessions",
  CURRENT_SESSION: "studentmind_current_session",
  SOURCES: "studentmind_sources",
  SAVED_NOTES: "studentmind_saved_notes",
} as const;

// ─── Encryption ───────────────────────────────────────────────────────────────

function encrypt(text: string): string {
  try {
    // Basic XOR-based encoding for demonstration.
    // In a real production app, use SubtleCrypto (AES-GCM) with a user-provided password.
    return btoa(unescape(encodeURIComponent(text))).split('').map((c, i) => 
      String.fromCharCode(c.charCodeAt(0) ^ (i % 5 + 1))
    ).join('');
  } catch { return text; }
}

function decrypt(text: string): string {
  try {
    const xor = text.split('').map((c, i) => 
      String.fromCharCode(c.charCodeAt(0) ^ (i % 5 + 1))
    ).join('');
    return decodeURIComponent(escape(atob(xor)));
  } catch { return text; }
}

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

// ─── Sources ──────────────────────────────────────────────────────────────────

export function saveSources(sources: SourceFile[]): void {
  try {
    const encrypted = sources.map(s => ({ ...s, content: encrypt(s.content) }));
    localStorage.setItem(KEYS.SOURCES, JSON.stringify(encrypted));
  } catch (e) {
    console.warn("Failed to save sources:", e);
  }
}

export function loadSources(): SourceFile[] {
  try {
    const raw = localStorage.getItem(KEYS.SOURCES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((s: any) => ({ ...s, content: decrypt(s.content) }));
  } catch {
    return [];
  }
}

// ─── Saved Notes ──────────────────────────────────────────────────────────────

export function saveNotes(notes: SavedNote[]): void {
  try {
    const encrypted = notes.map(n => ({ ...n, content: encrypt(n.content) }));
    localStorage.setItem(KEYS.SAVED_NOTES, JSON.stringify(encrypted));
  } catch (e) {
    console.warn("Failed to save notes:", e);
  }
}

export function loadNotes(): SavedNote[] {
  try {
    const raw = localStorage.getItem(KEYS.SAVED_NOTES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((n: any) => ({ ...n, content: decrypt(n.content) }));
  } catch {
    return [];
  }
}

export function clearAll(): void {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}
