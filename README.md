# SIMATS Capstone Report Generator (v1.0) 🎓🤖📜

A high-performance, AI-driven automation workstation designed to generate comprehensive, academically rigorous **Capstone Project Reports** (30+ pages) in accordance with the institutional standards of the **Saveetha Institute of Medical and Technical Sciences (SIMATS)**.

---

## 🚀 Key Features

- **Dual-AI Intelligence**: Orchestrates **Google Gemini 1.5 Pro** and **OpenAI GPT-4o** to generate deep technical content, domain analysis, and structured chapters.
- **30-Page Depth Engine**: Specifically optimized to produce high-volume academic text, technical appendices, and accurate references (Author, Title, Link format).
- **Institutional Alignment**: Automatically applies SIMATS formatting standards, including specific page margins, font hierarchies, and the "Academic Frame" borders.
- **Secure Cloud Integration**: Features **Firebase Authentication** (Sign in with Google) and a **Firestore Database** to persist student profiles and metadata across sessions.
- **Technical Visuals**: Integrated support for **Mermaid.js** diagrams, **LaTeX** technical equations, and **DALL-E 3** generated project illustrations.
- **Resiliency Pipeline**: A "Zero-Failure" architecture with automatic fallback to curated academic templates in case of API rate limits or network issues.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), Modern CSS3 (Glassmorphism & Dynamic Animations), HTML5.
- **Cloud Backend**: Firebase (Auth & Firestore).
- **AI Engines**: OpenAI API (GPT-4o), Google Gemini API (1.5 Pro).
- **Export Engine**: `docx.js` for high-fidelity Microsoft Word generation.
- **Development**: Vite, Vercel (Deployment), GitHub Actions.

---

## ⚙️ Configuration & Setup

### 1. Firebase Rules
To secure your student database, apply the following rules in the Firebase Console:
```javascript
service cloud.firestore {
  match /databases/{database}/documents {
    match /students/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 2. Deployment
This project is optimized for **Vercel**. 
1. Push to GitHub.
2. Connect the repository to Vercel.
3. Configure your Environment Variables for Gemini and OpenAI API keys.

---

## 📜 Academic Disclaimer
This tool is designed to assist students in formatting and structuring their research. Users are responsible for verifying the accuracy of AI-generated technical data and ensuring compliance with institutional plagiarism policies.

---
**Institutional Product for SIMATS Engineering**
✨ *Developing Professional Excellence* ✨
