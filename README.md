# ⟐ PeopleWithProjects (PWP)

> **Code Together. Ship Faster.**  
> A high-performance, real-time collaborative code editor built for hackathon sprints and rapid team builds.

![Landing Page](https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=1200)

## ⚡ Features

### 🖥️ Collaborative Editor
- **Real-time Sync**: Powered by Firestore with a smart 2s debounced save system to stay within Firebase free tier limits.
- **CodeMirror 6**: Industry-standard editor with syntax highlighting for JS, TS, Python, HTML, CSS, and more.
- **Live Presence**: See exactly who is in which file and where their cursor is, powered by Firebase Realtime Database.
- **File Explorer**: Robust tree view with context menus for renaming, duplicating, and deleting.

### 🔐 Secure & Scalable Auth
- **Social Login**: One-click Google Authentication.
- **Email/Pass**: Secure signup with real-time password strength indicators.
- **Auth Guard**: Protected routes ensuring your code stays between you and your team.

### 🏗️ Project Management
- **ZIP Upload**: Drop your entire codebase as a ZIP and start editing in seconds.
- **Team Management**: Invite up to 5 collaborators per project (Free Tier Optimized).
- **Fine-grained Permissions**: Auto-detects sensitive files (like `.env`) and restricts them by default.

### 🛡️ Built-in Security (SSL Honeypot)
- **Bot Detection**: Invisible honeypot fields to catch automated attackers.
- **IP Logging**: Automatic logging of suspicious auth attempts.
- **Rate Limiting**: Integrated protection against brute-force attacks.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router)
- **Backend**: [Firebase](https://firebase.google.com/) (Auth, Firestore, RTDB, Storage)
- **Editor**: [CodeMirror 6](https://codemirror.net/)
- **State**: React Context API
- **Styling**: Vanilla CSS (Premium Dark Theme)

## 🚀 Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/your-username/peoplewithprojects.git
cd peoplewithprojects
npm install
```

### 2. Configure Firebase
Create a `.env.local` file in the root and add your keys:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID
NEXT_PUBLIC_FIREBASE_DATABASE_URL=YOUR_RTDB_URL
```

### 3. Setup Firebase Services
Enable these in your Firebase Console:
- **Authentication**: Email/Password & Google
- **Firestore Database**: Start in Test Mode
- **Realtime Database**: Start in Test Mode (required for presence)
- **Storage**: Start in Test Mode

### 4. Run Development
```bash
npm run dev
```

## 📐 Limits & Optimization (Spark Plan)
- **Projects**: 1 per user (Free tier limit).
- **Members**: Max 5 per project.
- **Storage**: 50MB max ZIP upload.
- **Performance**: Presence & Cursors use RTDB to minimize Firestore read/write costs.

## 🛡️ SSL Honeypot Module
The security layer is located in `/ssl-honeypot`. It can be easily detached and used in any other project.

---

Built with ❤️ for the builder community.
