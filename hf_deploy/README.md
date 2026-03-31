---
title: EmotionAI Backend
emoji: 🧠
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
app_port: 7860
---

# EmotionAI Backend API

Flask + Gradio backend for the **EmotionAI** desktop application.

Exposes REST endpoints for facial + voice emotion analysis, history storage, and AI trend reports.

### Endpoints
| Method | Path | Description |
|---|---|---|
| `POST` | `/process` | Analyse a video/audio blob for emotions |
| `GET` | `/history` | Fetch historical readings |
| `DELETE` | `/history` | Clear history |
| `GET` | `/mappings` | Get emotion → music mappings |
| `POST` | `/mappings` | Save a mapping |
| `POST` | `/analyze_history` | Generate LLM trend report |
| `POST` | `/chat` | Chatbot |
| `GET` | `/health` | Health check |
