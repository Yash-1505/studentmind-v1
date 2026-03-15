<div align="center">

# 🎓 StudentMind

**An AI-powered learning companion for college & university students**

[![CI](https://github.com/yourusername/studentmind/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/studentmind/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev)

Simplified summaries · Cheat sheets · Learning paths · Quizzes · Resource finder

[**Deploy to Vercel**](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/studentmind) · [**Report Bug**](https://github.com/yourusername/studentmind/issues) · [**Request Feature**](https://github.com/yourusername/studentmind/issues)

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 💬 **Chat** | Ask anything across any subject with full conversation memory |
| 📄 **Simplified Summary** | ELI5 → Plain English → Key Ideas → Socratic check |
| 📋 **Cheat Sheet** | Structured quick-reference cards — export as PDF, Word, Markdown, or Text |
| 🗺️ **Learning Path** | Phase-by-phase roadmap with curated free resources |
| 🧠 **Practice & Quiz** | MCQ, fill-in-the-blank, short answer, essay — with scoring and weak-area detection |
| 🔍 **Resource Finder** | Curated free resources from MIT OCW, Khan Academy, NPTEL, YouTube, arXiv and more |
| 📁 **File Upload** | Upload PDFs, images, audio, markdown, text files — AI processes them directly |
| 🌍 **Multi-language** | 16 languages via Sarvam API (Indian languages) + Google Translate |
| 💾 **Session History** | 30 sessions stored locally — search, switch, delete |
| 📤 **Export** | Export any response or full conversation as PDF, Word (.docx), Markdown, or Plain Text |
| 🔗 **Share** | Copy conversation as Markdown or generate a shareable link |

---

## 🤖 Supported AI Providers

| Provider | Models | Free Tier | Best For |
|----------|--------|-----------|----------|
| **Google Gemini** | 2.5 Flash, 2.5 Pro | ✅ Yes | Default — multimodal, fast |
| **Groq** | Llama 3.3 70B, Llama 3.1 8B, Mixtral, Gemma | ✅ Yes | Fastest responses |
| **Cohere** | Command R+, Command R | ✅ Trial | Study & document analysis |
| **OpenAI** | GPT-4o, GPT-4o Mini, GPT-4 Turbo | ❌ Paid | Most reliable |
| **Mistral AI** | Small, Medium, Large | ❌ Paid | Strong multilingual |
| **Anthropic Claude** | 3.5 Haiku, 3.5 Sonnet, 3 Opus | ❌ Paid | Best reasoning (needs proxy) |

---

## 🚀 Quick Start

### Prerequisites
- [Node.js 18+](https://nodejs.org)
- An API key from at least one provider (Gemini and Groq both have free tiers)

### Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/yourusername/studentmind.git
cd studentmind

# 2. Install dependencies
npm install

# 3. (Optional) Set a default Gemini key
cp .env.example .env.local
# Edit .env.local: GEMINI_API_KEY=your_key_here

# 4. Run
npm run dev
```

Open http://localhost:3000

> You can skip the .env file entirely — just open Settings in the app and paste your key. It saves to localStorage automatically.

---

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/studentmind)

Click → Connect GitHub → Deploy. Done.

Optionally set GEMINI_API_KEY in Vercel env vars as a fallback default.

---

## 🔑 Getting API Keys

| Provider | Link | Notes |
|----------|------|-------|
| Google Gemini | https://aistudio.google.com | Free tier |
| Groq | https://console.groq.com/keys | Free tier, fastest |
| OpenAI | https://platform.openai.com/api-keys | Paid |
| Mistral | https://console.mistral.ai/api-keys | Paid |
| Anthropic | https://console.anthropic.com/keys | Paid + needs proxy |
| Cohere | https://dashboard.cohere.com/api-keys | Free trial |
| Sarvam | https://dashboard.sarvam.ai | Indian language translation |
| Google Translate | https://console.cloud.google.com | Other languages |

---

## 🏗️ Project Structure

```
studentmind/
├── src/
│   ├── types.ts                  # Shared TypeScript types
│   ├── App.tsx                   # Root — settings, history, sessions
│   ├── components/
│   │   ├── ChatInterface.tsx     # Main chat UI + AI routing
│   │   ├── HistoryPanel.tsx      # Session history sidebar
│   │   └── ExportMenu.tsx        # Export dropdown
│   └── utils/
│       ├── storage.ts            # localStorage layer
│       └── export.ts             # PDF, DOCX, MD, TXT engine
├── .github/workflows/ci.yml      # GitHub Actions CI
├── vercel.json                   # Vercel config
└── package.json
```

---

## 🔒 Privacy

- API keys stored only in your browser's localStorage — never sent to any server except your chosen AI provider
- No backend, no analytics, no tracking, no ads
- Session history lives on your device only

---

## 🛠️ Tech Stack

React 19 · TypeScript · Tailwind CSS v4 · Vite 6 · Google GenAI SDK · html2pdf.js · docx · Sarvam API · Google Translate

---

## License

MIT — see LICENSE for details.
