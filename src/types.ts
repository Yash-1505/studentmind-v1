// ─── Shared Types ─────────────────────────────────────────────────────────────

export enum Mode {
  CHAT = "Chat",
  SUMMARY = "Simplified Summary",
  CHEATSHEET = "Cheat Sheet",
  LEARNING_PATH = "Learning Path",
  PRACTICE_QUIZ = "Practice & Quiz",
  RESOURCE_FINDER = "Resource Finder",
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "ai";
  mode?: Mode;
  fileInfo?: { name: string; type: string };
  timestamp: string; // ISO string for JSON serialization
  isError?: boolean;
}

export interface Session {
  id: string;
  title: string;
  messages: ChatMessage[];
  provider: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIModel {
  id: string;
  label: string;
  description: string;
  fast?: boolean;
  smart?: boolean;
}

export interface AIProvider {
  id: string;
  name: string;
  logo: string;
  color: string;
  bgColor: string;
  borderColor: string;
  keyPlaceholder: string;
  keyHint: string;
  keyLink: string;
  keyLinkLabel: string;
  models: AIModel[];
  corsNote?: string;
}

export interface AppSettings {
  activeProvider: string;
  selectedModels: Record<string, string>;
  apiKeys: Record<string, string>;
  language: string;
  trackProgress: boolean;
  sarvamKey: string;
  googleTranslateKey: string;
}
