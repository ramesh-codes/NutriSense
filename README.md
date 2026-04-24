```markdown
# 🥗 NutriSense — AI-Powered Food & Health Assistant

**AMD Day 1 Hackathon** · Built with Vanilla JS + Node.js + Google Gemini

NutriSense is a smart dietary assistant that helps users make healthier food choices through empathetic AI-powered guidance — substitutions, harm reduction tips, and nutritional insight — all in real time.

## ✨ Features

* **🔑 Zero-Trust API Key Handling** — Your Gemini API key never leaves your browser
* **🥦 Smart Substitutions** — AI suggests healthier alternatives to your cravings
* **💬 Empathetic Dietary Consultant** — Harm-reduction first, judgement-free responses
* **♿ Fully Accessible** — ARIA labels, semantic HTML, high-contrast UI
* **☁️ Cloud-Native** — Deploys seamlessly to Google Cloud Run using Buildpacks (no Dockerfile needed)
* **⚡ Ultra-Lightweight** — Entire repo under 1 MB, no heavy frameworks

## 🚀 Quick Start (Local)

**Prerequisites**
* Node.js v18 or higher
* A [Google Gemini API Key](https://aistudio.google.com/app/apikey) (free tier available)

**Run Locally**

```bash
# 1. Clone the repository
git clone [https://github.com/ramesh-codes/NutriSense.git](https://github.com/ramesh-codes/NutriSense.git)
cd NutriSense

# 2. Install dependencies (only Express!)
npm install

# 3. Start the server
npm start

# → Server running at http://localhost:8080
```
Open `http://localhost:8080` in your browser, paste your Gemini API key, and start chatting!

## ☁️ Deploy to Google Cloud Run

**Prerequisites**
* Install & authenticate the Google Cloud SDK
* Enable required APIs: `gcloud services enable run.googleapis.com artifactregistry.googleapis.com`

**Deploy directly from source**
Because this project uses Google Cloud Buildpacks, you do not need a Dockerfile. Google Cloud will automatically detect the Node.js environment and build the container for you.

```bash
# Deploy directly from your project folder
gcloud run deploy nutrisense \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

After deployment, Cloud Run prints a Service URL like:
`Service URL: https://nutrisense-xxxxxxxx-uc.a.run.app`

## 🔐 Security Model

| Concern | How NutriSense Handles It |
| :--- | :--- |
| **API Key storage** | Browser memory only — never sent to server |
| **Server-side secrets** | None — server only serves static files |
| **Network requests** | Direct browser → Gemini API (HTTPS) |
| **Dependencies** | Only `express` — minimal attack surface |

*⚠️ Note: For production use, consider moving the Gemini API call to the server side and storing the key in a Secret Manager (e.g., Google Cloud Secret Manager).*

## 📁 Project Structure

```text
nutrisense/
├── public/
│   ├── index.html     # Semantic HTML5 UI
│   ├── style.css      # Accessible, high-contrast CSS
│   └── app.js         # Client-side Gemini API integration
├── server.js          # Lightweight Express static server
├── package.json
└── README.md
```

## 🛠️ Tech Stack

* **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES2022)
* **Backend:** Node.js + Express (static server only)
* **AI:** Google Gemini 2.5 Flash (`gemini-2.5-flash`)
* **Cloud:** Google Cloud Run (via Buildpacks)
```
