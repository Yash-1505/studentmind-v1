<div align="center">

<img src="https://img.shields.io/badge/StudentMind-AI%20Learning%20Companion-5BBCFF?style=for-the-badge&logo=graduationcap&logoColor=white" alt="StudentMind"/>

# 🎓 StudentMind

### Your personal AI-powered study companion — built for college & university students

[![CI](https://github.com/Yash-1505/studentmind-v1/actions/workflows/ci.yml/badge.svg)](https://github.com/Yash-1505/studentmind-v1/actions)
[![License: BUSL 1.1](https://img.shields.io/badge/License-BUSL%201.1-FFD1E3?style=flat)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-5BBCFF?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React-19-7EA1FF?style=flat&logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6-FFFAB7?style=flat&logo=vite&logoColor=black)](https://vitejs.dev)

**Simplified summaries · Cheat sheets · Learning paths · Quizzes · Resource finder**

[🚀 Quick Start](#-quick-start) · [✨ Features](#-features) · [🤖 AI Providers](#-supported-ai-providers) · [📦 Deploy](#-deploy-to-vercel) · [🔑 API Keys](#-getting-api-keys)

</div>

---

## 📸 Overview

StudentMind is a dark-themed, browser-based AI study tool that connects directly to your choice of AI provider — no backend, no data collection, no subscriptions. Just paste your API key and start learning.

Built with **React 19 + TypeScript + Tailwind CSS v4**, styled with a custom pastel-on-dark design system using **Syne** and **Instrument Sans** typefaces.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 💬 **Chat** | Ask anything across any subject with full conversation memory |
| 📄 **Simplified Summary** | ELI5 → Plain English → Key Ideas → Socratic check question |
| 📋 **Cheat Sheet** | Structured quick-reference cards — export as PDF, Word, Markdown, or Text |
| 🗺️ **Learning Path** | Phase-by-phase roadmap with curated free resources and time estimates |
| 🧠 **Practice & Quiz** | MCQ, fill-in-the-blank, short answer, essay — with scoring and weak-area detection |
| 🔍 **Resource Finder** | Curated free resources from MIT OCW, Khan Academy, NPTEL, YouTube, arXiv and more |
| 📁 **File Upload** | Upload PDFs, images, audio, markdown, CSV, text files — AI processes them directly |
| 🎙️ **Voice Input** | Record voice notes and send them as messages |
| 🌍 **Multi-language** | 16 languages via Sarvam API (Indian languages) + Google Translate |
| 💾 **Session History** | 30 sessions stored locally — search, switch, delete anytime |
| 📤 **Export** | Export any AI response or full conversation as PDF, Word (.docx), Markdown, or Plain Text |
| 🔗 **Share** | Copy conversation as Markdown or generate a shareable encoded link |
| 📊 **Progress Tracking** | Track topics covered and weak areas across a session |

---

## 🤖 Supported AI Providers

| Provider | Models | Free Tier | Best For |
|----------|--------|-----------|----------|
| 🔵 **Google Gemini** | Gemini 2.5 Flash, Gemini 2.5 Pro | ✅ Yes | Default — multimodal, fast |
| 🟠 **Groq** | Llama 3.3 70B, Llama 3.1 8B, Mixtral, Gemma 2 | ✅ Yes | Fastest responses |
| 🩷 **Cohere** | Command R+, Command R | ✅ Trial | Study & document analysis |
| 🟢 **OpenAI** | GPT-4o, GPT-4o Mini, GPT-4 Turbo | ❌ Paid | Most reliable |
| 🟡 **Mistral AI** | Small, Medium, Large | ❌ Paid | Strong multilingual support |
| 🔷 **Anthropic Claude** | 3.5 Haiku, 3.5 Sonnet, 3 Opus | ❌ Paid | Best reasoning *(needs proxy)* |

> 💡 **Recommended to start:** Google Gemini or Groq — both have generous free tiers.

---

## 🚀 Quick Start

### Prerequisites

- [Node.js 18+](https://nodejs.org)
- An API key from at least one provider (Gemini and Groq both have free tiers)

### Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/Yash-1505/studentmind-v1.git
cd studentmind-v1

# 2. Install dependencies
npm install

# 3. (Optional) Set a default Gemini key
cp .env.example .env.local
# Edit .env.local → add: GEMINI_API_KEY=your_key_here

# 4. Start the dev server
npm run dev
```

Open **<http://localhost:3000>** in your browser.

> ✅ You can skip the `.env` file entirely — open **Settings ⚙** in the app and paste your API key. It saves to `localStorage` automatically and never leaves your browser.

---

## 📦 Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Yash-1505/studentmind-v1)

1. Click the button above
2. Connect your GitHub account
3. Hit **Deploy** — done in under 2 minutes

> Optionally set `GEMINI_API_KEY` in Vercel environment variables as a shared default key for all users.

---

## 🔑 Getting API Keys

| Provider | Link | Notes |
|----------|------|-------|
| Google Gemini | [aistudio.google.com](https://aistudio.google.com) | Free tier available |
| Groq | [console.groq.com/keys](https://console.groq.com/keys) | Free tier, extremely fast |
| OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | Paid usage required |
| Mistral AI | [console.mistral.ai/api-keys](https://console.mistral.ai/api-keys) | Paid usage required |
| Anthropic Claude | [console.anthropic.com/keys](https://console.anthropic.com/keys) | Paid + needs CORS proxy |
| Cohere | [dashboard.cohere.com/api-keys](https://dashboard.cohere.com/api-keys) | Free trial available |
| Sarvam *(optional)* | [dashboard.sarvam.ai](https://dashboard.sarvam.ai) | Indian language translation |
| Google Translate *(optional)* | [console.cloud.google.com](https://console.cloud.google.com) | Other language translation |

---

## 🏗️ Project Structure

```
studentmind-v1/
├── src/
│   ├── types.ts                    # Shared TypeScript types & enums
│   ├── main.tsx                    # App entry point
│   ├── index.css                   # Design system, CSS variables, animations
│   ├── App.tsx                     # Root — settings drawer, session management
│   ├── components/
│   │   ├── ChatInterface.tsx       # Main chat UI + AI provider routing
│   │   ├── HistoryPanel.tsx        # Session history sidebar
│   │   └── ExportMenu.tsx          # Per-message export dropdown
│   └── utils/
│       ├── storage.ts              # localStorage persistence layer
│       └── export.ts               # PDF, DOCX, Markdown, TXT export engine
├── .env.example                    # Environment variable template
├── .github/workflows/ci.yml        # GitHub Actions CI
├── vercel.json                     # Vercel deployment config
├── vite.config.ts                  # Vite build config
└── package.json
```

---

## 🎨 Design System

The UI uses a custom pastel-on-dark palette:

| Token | Color | Usage |
|-------|-------|-------|
| `--blue` | `#5BBCFF` | Primary actions, user bubbles, links |
| `--periwinkle` | `#7EA1FF` | AI accent, Summary & Quiz modes |
| `--yellow` | `#FFFAB7` | Warnings, Groq provider, Cheat Sheet |
| `--pink` | `#FFD1E3` | Learning Path, Mistral, export accents |
| `--bg-base` | `#07070e` | App background |

Fonts: **Syne** (headings/display) + **Instrument Sans** (body)

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React 19 |
| Language | TypeScript 5.8 |
| Styling | Tailwind CSS v4 |
| Build Tool | Vite 6 |
| AI — Gemini | `@google/genai` SDK |
| AI — Others | REST API (OpenAI-compatible + Anthropic + Cohere) |
| PDF Export | `html2pdf.js` |
| DOCX Export | `docx` |
| Markdown Render | `react-markdown` |
| Translation | Sarvam API + Google Translate API |

---

## 🔒 Privacy & Security

- 🔐 API keys stored **only** in your browser's `localStorage` — never sent to any server except your chosen AI provider directly
- 🚫 No backend, no database, no analytics, no tracking, no ads
- 💻 Session history lives on your device only — nothing is uploaded
- 🧹 Clear everything anytime via browser settings

---

## 📜 License

> ⚠️ **StudentMind** is licensed under the [Business Source License 1.1 (BUSL 1.1)](https://mariadb.com/bsl11/).

- ✅ Free for personal and educational use
- ✅ You may view and fork the source code
- ❌ Commercial use requires explicit written permission from the author
- ❌ You may not resell, rebrand, or host this as a paid service without permission

For commercial licensing enquiries, contact: **<myashwanth1505@gmail.com>**

© 2026 Yashwanth Marella. All rights reserved.
