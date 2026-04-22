# 🚀 Deploy EmotionAI Backend to Hugging Face Spaces

Follow these steps exactly. Takes ~10 minutes.

---

## Prerequisites

- [Hugging Face account](https://huggingface.co/join) (free)
- [Git](https://git-scm.com/downloads) installed
- [Git LFS](https://git-lfs.com/) installed (for model files)

Install Git LFS once:
```bash
git lfs install
```

---

## Step 1 — Create the HF Space

1. Go to [huggingface.co/new-space](https://huggingface.co/new-space)
2. Fill in:
   - **Space name**: `emotionai-backend`
   - **License**: MIT
   - **SDK**: **Docker** ← important
   - **Hardware**: CPU Basic (free)
3. Click **Create Space**

Your space URL will be: `https://huggingface.co/spaces/YOUR-USERNAME/emotionai-backend`

---

## Step 2 — Clone the Space

```bash
git clone https://huggingface.co/spaces/YOUR-USERNAME/emotionai-backend
cd emotionai-backend
```

---

## Step 3 — Copy deployment files

Copy everything from `hf_deploy/` into the cloned folder:

```bash
# From the project root (4-2-project/)
xcopy hf_deploy\* emotionai-backend\ /E /H /Y
```

Or manually copy these files into `emotionai-backend/`:
```
app.py
Dockerfile
requirements.txt
README.md
.gitattributes
models/
  audio_emotion_model.h5
  video_emotion_model.h5
  fusion_emotion.h5
  haarcascade_frontalface_default.xml
```

---

## Step 4 — Track model files with Git LFS

Inside the `emotionai-backend/` folder:

```bash
git lfs track "*.h5"
git lfs track "*.xml"
git add .gitattributes
```

---

## Step 5 — Set your GROQ API Key (Secret)

> ⚠️ Do NOT put API keys in code or git. Use HF Secrets instead.

1. Go to your Space → **Settings** tab
2. Scroll to **Variables and secrets**
3. Click **New secret**
4. Name: `GROQ_API_KEY`  Value: your Groq API key
5. Click Save

---

## Step 6 — Push to deploy

```bash
git add .
git commit -m "deploy: EmotionAI backend v1"
git push
```

HF will build the Docker image automatically. Watch the build log in the **Logs** tab of your Space.  
First build takes **5-10 minutes** (installing TensorFlow).

---

## Step 7 — Get your Space URL

Once the build is green, your API is live at:
```
https://YOUR-USERNAME-emotionai-backend.hf.space
```

Test it:
```
https://YOUR-USERNAME-emotionai-backend.hf.space/health
```

You should see:
```json
{ "status": "ok", "models": true, "timestamp": "..." }
```

---

## Step 8 — Update the Electron App

Open `frontend/main.cjs` and replace line with `HF_SPACE_URL`:

```js
// Before:
const HF_SPACE_URL = process.env.HF_SPACE_URL || 'https://YOUR-USERNAME-emotionai-backend.hf.space';

// After (your actual URL):
const HF_SPACE_URL = process.env.HF_SPACE_URL || 'https://chint-emotionai-backend.hf.space';
```

Then rebuild:
```bash
cd frontend
npm run build
npm run electron:build
```

Your final installer will be in `frontend/release/` — share the `.exe` file!

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Build fails with OOM | HF free tier has 16 GB RAM — should be enough. If still fails, check logs for which package failed |
| `/health` returns 503 | Models not loaded yet, wait 30s after first start |
| `groq` errors | Check GROQ_API_KEY is set in Space Secrets |
| Port not found | Make sure Dockerfile has `EXPOSE 7860` and `CMD ["python", "app.py"]` |

---

## What users get

When you share the Electron `.exe`:
- They double-click it — app opens
- App connects automatically to `https://YOUR-USERNAME-emotionai-backend.hf.space`
- No Python, no Flask, no setup needed on their machine
- Final `.exe` size: **~150 MB** (vs 2.5 GB with PyInstaller)
