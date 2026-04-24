# 🥗 NutriSense — AI-Powered Food & Health Assistant

> **AMD Day 1 Hackathon** · Built with Vanilla JS + Node.js + Google Gemini

NutriSense is a smart dietary assistant that helps users make healthier food choices through empathetic AI-powered guidance — substitutions, harm reduction tips, and nutritional insight — all in real time.

---

## ✨ Features

- 🔑 **Zero-Trust API Key Handling** — Your Gemini API key never leaves your browser
- 🥦 **Smart Substitutions** — AI suggests healthier alternatives to your cravings
- 💬 **Empathetic Dietary Consultant** — Harm-reduction first, judgement-free responses
- ♿ **Fully Accessible** — ARIA labels, semantic HTML, high-contrast UI
- 🐳 **Containerized** — Docker-ready, deploys to Google Cloud Run in minutes
- ⚡ **Ultra-Lightweight** — Entire repo under 1 MB, no heavy frameworks

---

## 🚀 Quick Start (Local)

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- A [Google Gemini API Key](https://aistudio.google.com/app/apikey) (free tier available)

### Run Locally
```bash
# 1. Clone the repository
git clone https://github.com/your-org/nutrisense.git
cd nutrisense

# 2. Install dependencies (only Express!)
npm install

# 3. Start the server
npm start
# → Server running at http://localhost:8080
```

Open `http://localhost:8080` in your browser, paste your Gemini API key, and start chatting!

---

## 🐳 Docker

### Build & Run Locally with Docker
```bash
# Build the image
docker build -t nutrisense .

# Run the container
docker run -p 8080:8080 nutrisense

# → Open http://localhost:8080
```

---

## ☁️ Deploy to Google Cloud Run

### Prerequisites
1. Install & authenticate the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
2. Enable required APIs:
   ```bash
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com
   ```

### Option A — Deploy directly from source (recommended)
```bash
# Set your project
gcloud config set project YOUR_PROJECT_ID

# Deploy directly — Cloud Run builds the container for you
gcloud run deploy nutrisense \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10
```

### Option B — Build, push, then deploy
```bash
# Configure Docker to use gcloud as credential helper
gcloud auth configure-docker us-central1-docker.pkg.dev

# Create Artifact Registry repository (one-time)
gcloud artifacts repositories create nutrisense-repo \
  --repository-format=docker \
  --location=us-central1

# Build and push the image
IMAGE="us-central1-docker.pkg.dev/YOUR_PROJECT_ID/nutrisense-repo/nutrisense:latest"

docker build -t $IMAGE .
docker push $IMAGE

# Deploy to Cloud Run
gcloud run deploy nutrisense \
  --image $IMAGE \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 256Mi
```

After deployment, Cloud Run prints a **Service URL** like:
```
Service URL: https://nutrisense-xxxxxxxx-uc.a.run.app
```

---

## 🔐 Security Model

| Concern | How NutriSense Handles It |
|---|---|
| API Key storage | Browser memory only — never sent to server |
| Server-side secrets | None — server only serves static files |
| Network requests | Direct browser → Gemini API (HTTPS) |
| Container privileges | Runs as non-root user (`nutrisense`) |
| Dependencies | Only `express` — minimal attack surface |

> ⚠️ **Note:** For production use, consider moving the Gemini API call to the server side and storing the key in a Secret Manager (e.g., [Google Cloud Secret Manager](https://cloud.google.com/secret-manager)).

---

## 📁 Project Structure

```
nutrisense/
├── public/
│   ├── index.html     # Semantic HTML5 UI
│   ├── style.css      # Accessible, high-contrast CSS
│   └── app.js         # Client-side Gemini API integration
├── server.js          # Lightweight Express static server
├── package.json
├── Dockerfile         # Multi-stage alpine build
├── .dockerignore
└── README.md
```

---

## 🛠️ Tech Stack

- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES2022)
- **Backend:** Node.js + Express (static server only)
- **AI:** Google Gemini 1.5 Flash (`gemini-1.5-flash`)
- **Container:** Docker (node:20-alpine)
- **Cloud:** Google Cloud Run

---

## 📄 License

MIT © NutriSense Team — AMD Day 1 Hackathon 2026