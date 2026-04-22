"""
EmotionAI HF Spaces Backend
============================
Flask REST API + Gradio status UI running on port 7860.
Deploy this folder to a Hugging Face Docker Space.

Endpoints:
  POST /process          — video/audio blob → emotion analysis
  GET  /history          — fetch stored readings
  DELETE /history        — clear history
  GET  /mappings         — get emotion→music mappings
  POST /mappings         — save mapping
  POST /analyze_history  — LLM trend report
  POST /chat             — chatbot
  GET  /health           — health check
"""

import os, sys, json, sqlite3, tempfile, threading
from datetime import datetime
from time import perf_counter

# ── Silence TF noise ──────────────────────────────────────────
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

import numpy as np
import cv2
import librosa
import requests
import soundfile as sf
import ffmpeg as ffmpeg_lib

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import keras
import gradio as gr

# ── Flask App ─────────────────────────────────────────────────
flask_app = Flask(__name__)
CORS(flask_app, resources={r"/*": {"origins": "*"}})
flask_app.config['MAX_CONTENT_LENGTH'] = 200 * 1024 * 1024   # 200 MB

# ── Config ─────────────────────────────────────────────────────
GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')
GROQ_URL     = 'https://api.groq.com/openai/v1/chat/completions'
DB_PATH      = '/tmp/emotionai.db'
EMOTIONS_7   = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgust', 'surprised']

SR          = 16000
N_MFCC      = 13
HOP_LENGTH  = 512
N_FRAMES    = 300
TARGET_SIZE = (112, 112)
NUM_FRAMES  = 10
WINDOW_SIZE = 0.025
HOP_SIZE    = 0.01

# ── Database ──────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            fused_emotion TEXT, audio_emotion TEXT, video_emotion TEXT,
            confidence REAL, stability REAL, reasoning TEXT,
            stress_score REAL, stress_label TEXT)''')
        conn.execute('''CREATE TABLE IF NOT EXISTS music_mappings (
            emotion TEXT PRIMARY KEY, music_path TEXT)''')
        conn.commit()

init_db()

# ── Robust Model Loader ──────────────────────────────────────
# Fixes version-specific deserialization errors like 'quantization_config' or 'batch_shape'
def robust_load_model(path):
    from keras import layers
    
    # Custom Dense to ignore quantization_config
    original_dense_from_config = layers.Dense.from_config
    @classmethod
    def dense_from_config(cls, config):
        config.pop('quantization_config', None)
        return original_dense_from_config(config)
    
    # Custom InputLayer to ignore batch_shape and fix dimensions
    original_input_from_config = layers.InputLayer.from_config
    @classmethod
    def input_from_config(cls, config):
        # Keras 3 'shape' = input dimensions EXCLUDING batch.
        # Older models used 'batch_shape' which INCLUDED batch.
        if 'batch_shape' in config:
            bs = config.pop('batch_shape')
            if isinstance(bs, list) and len(bs) > 0:
                config['shape'] = bs[1:]
        # Remove legacy keys to avoid conflicts
        config.pop('input_shape', None)
        config.pop('batch_input_shape', None)
        return original_input_from_config(config)

    # Apply overrides in a custom object scope
    custom_objects = {
        'Dense': layers.Dense,
        'InputLayer': layers.InputLayer
    }
    # We monkeypatch the from_config for the duration of the load
    old_dense_fc = layers.Dense.from_config
    old_input_fc = layers.InputLayer.from_config
    layers.Dense.from_config = dense_from_config
    layers.InputLayer.from_config = input_from_config
    
    try:
        model = keras.models.load_model(path)
        return model
    finally:
        layers.Dense.from_config = old_dense_fc
        layers.InputLayer.from_config = old_input_fc

# ── Load Models ───────────────────────────────────────────────
print('[EmotionAI] Loading models...')
MODEL_ERROR = None
try:
    audio_model = robust_load_model('models/audio_emotion_model.h5')
    video_model = robust_load_model('models/video_emotion_model.h5')
    
    # MobileNetV2 is standard, load normally
    base_cnn = keras.applications.MobileNetV2(weights='imagenet', include_top=False, input_shape=(112, 112, 3))
    base_cnn.trainable = False
    feature_extractor = keras.Sequential([base_cnn, keras.layers.GlobalAveragePooling2D()])
    
    fusion_model = robust_load_model('models/fusion_emotion.h5')
    MODELS_OK = True
    print('[EmotionAI] Models loaded ✓')
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f'[EmotionAI] Model load error: {e}')
    MODEL_ERROR = str(e)
    audio_model = video_model = feature_extractor = fusion_model = None
    MODELS_OK = False

FACE_CASCADE_PATH = os.path.join(cv2.data.haarcascades, 'haarcascade_frontalface_default.xml')
FACE_CASCADE = cv2.CascadeClassifier(FACE_CASCADE_PATH)

# ── Helpers ───────────────────────────────────────────────────
STRESS_BASELINE = {'happy': 0.15, 'neutral': 0.25, 'surprised': 0.45,
                   'sad': 0.65, 'disgust': 0.70, 'fearful': 0.80, 'angry': 0.85}

def estimate_stress(emotion, stability, transition_rate):
    base = STRESS_BASELINE.get(emotion, 0.35)
    score = float(np.clip(base + 0.2 * float(transition_rate) + 0.1 * (1 - float(stability)), 0, 1))
    label = 'low' if score < 0.35 else ('moderate' if score < 0.65 else 'high')
    return score, label

def extract_mfcc(audio_path):
    try:
        y, sr = librosa.load(audio_path, sr=SR, mono=True)
        if len(y) == 0:
            raise ValueError('Empty audio')
        full_mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=N_MFCC, hop_length=HOP_LENGTH).T
        window_frames = max(1, int((WINDOW_SIZE * sr) / HOP_LENGTH))
        hop_frames    = max(1, int((HOP_SIZE   * sr) / HOP_LENGTH))
        windows = []
        for start in range(0, full_mfcc.shape[0] - window_frames + 1, hop_frames):
            s = full_mfcc[start:start + window_frames]
            if s.shape[0] < N_FRAMES:
                s = np.pad(s, ((0, N_FRAMES - s.shape[0]), (0, 0)))
            else:
                s = s[:N_FRAMES]
            windows.append(s[..., np.newaxis])
        if not windows:
            s = full_mfcc[:N_FRAMES]
            if s.shape[0] < N_FRAMES:
                s = np.pad(s, ((0, N_FRAMES - s.shape[0]), (0, 0)))
            windows.append(s[..., np.newaxis])
        return np.array(windows)
    except Exception as e:
        print(f'MFCC error: {e}')
        return None

def extract_audio_from_video(video_path, audio_path):
    try:
        (ffmpeg_lib.input(video_path).output(audio_path, acodec='pcm_s16le', ar=SR, ac=1).run(overwrite_output=True, quiet=True))
        return True
    except Exception as e:
        print(f'FFmpeg error: {e}')
        return False

def extract_video_frames(video_path):
    cap = cv2.VideoCapture(video_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frames = []
    idxs = np.linspace(0, max(total - 1, 0), NUM_FRAMES, dtype=int)
    for i in idxs:
        cap.set(cv2.CAP_PROP_POS_FRAMES, i)
        ok, frame = cap.read()
        if not ok:
            break
        gray  = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = FACE_CASCADE.detectMultiScale(gray, 1.1, 5) if FACE_CASCADE else []
        if len(faces):
            x, y, w, h = faces[0]
            crop = frame[y:y+h, x:x+w]
        else:
            crop = frame
        crop = cv2.resize(crop, TARGET_SIZE)
        crop = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        frames.append(crop)
    cap.release()
    while len(frames) < NUM_FRAMES:
        frames.append(np.zeros((*TARGET_SIZE, 3), dtype=np.float32))
    return np.array(frames[:NUM_FRAMES])

def fuse_emotions(audio_probs, video_probs):
    if audio_probs is None and video_probs is None:
        uniform = np.ones(7) / 7
        return uniform, uniform.tolist(), 'neutral', 0.5, 0.5
    if audio_probs is None:
        fused = video_probs
    elif video_probs is None:
        fused = audio_probs
    else:
        fused = 0.4 * audio_probs + 0.6 * video_probs
    fused = fused / (fused.sum() + 1e-9)
    idx = int(np.argmax(fused))
    emotion = EMOTIONS_7[idx]
    confidence = float(fused[idx])
    stability = float(1.0 - np.std(fused))
    return fused, fused.tolist(), emotion, confidence, stability

def build_reasoning(emotion, confidence, stability, stress_label, audio_em, video_em):
    conf_txt = 'Strong' if confidence > 0.7 else ('Moderate' if confidence > 0.5 else 'Mixed')
    stab_txt = 'High' if stability > 0.7 else ('Moderate' if stability > 0.5 else 'Low')
    return (f'{conf_txt} emotional consistency: {emotion} leads at {confidence:.1%}. '
            f'{stab_txt} stability. Stress: {stress_label}.')

def generate_fallback_content(emotion):
    defaults = {
        'happy':    {'story': 'You are in a great state today. Keep the momentum going!', 'quote': '"Happiness is a direction, not a place." — Sydney J. Harris'},
        'sad':      {'story': 'Low moments pass. Rest, reflect, and be kind to yourself.', 'quote': '"This too shall pass."'},
        'angry':    {'story': 'Take a breath. Channeling your intensity leads to better decisions.', 'quote': '"For every minute angry you lose sixty seconds of happiness." — Emerson'},
        'fearful':  {'story': 'Fear is a signal, not a sentence. You have navigated hard things before.', 'quote': '"The only thing to fear is fear itself." — FDR'},
        'disgust':  {'story': 'Boundaries and clarity are strengths. Trust what feels wrong.', 'quote': '"Knowing yourself is the beginning of all wisdom." — Aristotle'},
        'surprised':{'story': 'Novelty sharpens your mind. Embrace the unexpected.', 'quote': '"Life is what happens when you are busy making other plans." — Lennon'},
        'neutral':  {'story': 'A calm and steady state is power. You are in control.', 'quote': '"Equanimity is the guardian of the wise." — Epictetus'},
    }
    base = defaults.get(emotion, defaults['neutral'])
    base.update({'songs': [{'artist': 'Coldplay', 'title': 'Fix You', 'explanation': 'Calming.'},
                           {'artist': 'Imagine Dragons', 'title': 'Believer', 'explanation': 'Energising.'},
                           {'artist': 'Hans Zimmer', 'title': 'Time', 'explanation': 'Focusing.'}],
                 'video': {'title': 'Emotional Wellness', 'channel': 'TED', 'link': 'https://www.youtube.com/results?search_query=emotional+wellness+ted', 'reason': 'Relevant research-backed talk.'},
                 'books': [{'title': 'The Power of Now', 'author': 'Eckhart Tolle', 'reason': 'Mindfulness for any state.', 'purchase_link': 'https://www.google.com/search?q=The+Power+of+Now+buy'}],
                 'memes': [{'template': 'This Is Fine', 'caption': 'Another day, another growth opportunity.', 'reason': 'Universal workplace humour.'}]})
    return base

def call_groq(prompt, api_key=None):
    use_key = api_key or GROQ_API_KEY
    if not use_key:
        return None
    try:
        resp = requests.post(GROQ_URL,
            headers={'Authorization': f'Bearer {use_key}', 'Content-Type': 'application/json'},
            json={'model': 'llama-3.3-70b-versatile', 'messages': [{'role': 'user', 'content': prompt}],
                  'temperature': 0.7, 'max_tokens': 1024},
            timeout=30)
        if resp.status_code == 200:
            content = resp.json()['choices'][0]['message']['content'].strip()
            if content.startswith('```json'): content = content[7:]
            if content.endswith('```'):       content = content[:-3]
            return json.loads(content.strip())
    except Exception as e:
        print(f'Groq error: {e}')
    return None

# ─────────────────────────────────────────────────────────────
# Flask Endpoints
# ─────────────────────────────────────────────────────────────

import tensorflow as tf

@flask_app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok",
        "models": MODELS_OK,
        "model_error": str(MODEL_ERROR) if not MODELS_OK else None,
        "tf_version": tf.__version__,
        "keras_version": keras.__version__,
        "timestamp": datetime.now().isoformat()
    })

@flask_app.post('/process')
def process():
    if not MODELS_OK:
        return jsonify({'error': 'Models not loaded'}), 503

    file = request.files.get('video') or request.files.get('file')
    if not file:
        return jsonify({'error': 'No file uploaded'}), 400

    with tempfile.TemporaryDirectory() as tmp:
        vid_path   = os.path.join(tmp, 'input.webm')
        audio_path = os.path.join(tmp, 'audio.wav')
        file.save(vid_path)

        # ── Audio ─────────────────────────────────────────
        audio_probs = None
        audio_preds = []
        if extract_audio_from_video(vid_path, audio_path):
            feats = extract_mfcc(audio_path)
            if feats is not None and len(feats):
                preds = audio_model.predict(feats, verbose=0)
                audio_preds = [EMOTIONS_7[np.argmax(p)] for p in preds]
                audio_probs = preds.mean(axis=0)

        # ── Video ─────────────────────────────────────────
        video_probs = None
        video_preds = []
        try:
            frames = extract_video_frames(vid_path)
            feats  = feature_extractor.predict(frames, verbose=0)
            preds  = video_model.predict(feats, verbose=0)
            video_preds = [EMOTIONS_7[np.argmax(p)] for p in preds]
            video_probs = preds.mean(axis=0)
        except Exception as e:
            print(f'Video prediction error: {e}')

        # ── Fusion ────────────────────────────────────────
        fused_vec, fused_list, emotion, confidence, stability = fuse_emotions(audio_probs, video_probs)
        transition_rate = len(set(audio_preds + video_preds)) / max(len(audio_preds + video_preds), 1)
        stress_score, stress_label = estimate_stress(emotion, stability, transition_rate)
        reasoning = build_reasoning(emotion, confidence, stability, stress_label,
                                    audio_preds[-1] if audio_preds else 'unknown',
                                    video_preds[-1] if video_preds else 'unknown')

        # ── LLM content ───────────────────────────────────
        api_key = request.form.get('groq_api_key') or GROQ_API_KEY
        prompt = f"""
You are a workplace wellness AI. Generate supportive content for a software employee.

Primary Emotion: {emotion}
Summary: {reasoning}
Audio timeline: {', '.join(audio_preds[-5:])}
Video timeline: {', '.join(video_preds[-5:])}

Return a valid JSON object:
{{
  "story": "calming 90-110 word reflection",
  "quote": "short relevant quote",
  "video": {{"title": "", "channel": "", "link": "", "reason": ""}},
  "books": [{{"title": "", "author": "", "reason": "", "purchase_link": ""}}],
  "songs": [
    {{"artist": "", "title": "", "explanation": ""}},
    {{"artist": "", "title": "", "explanation": ""}},
    {{"artist": "", "title": "", "explanation": ""}}
  ],
  "memes": [{{"template": "", "caption": "", "reason": ""}}]
}}
Return ONLY the JSON. Exactly 3 songs, exactly 2 memes."""

        llm = call_groq(prompt, api_key=api_key) if api_key or GROQ_API_KEY else None
        content = llm or generate_fallback_content(emotion)

        # ── Persist to DB ─────────────────────────────────
        try:
            with get_db() as conn:
                conn.execute('''INSERT INTO history
                    (fused_emotion, audio_emotion, video_emotion, confidence, stability, reasoning, stress_score, stress_label)
                    VALUES (?,?,?,?,?,?,?,?)''',
                    (emotion,
                     audio_preds[-1] if audio_preds else None,
                     video_preds[-1] if video_preds else None,
                     confidence, stability, reasoning, stress_score, stress_label))
                conn.commit()
        except Exception as e:
            print(f'DB write error: {e}')

        return jsonify({
            'fused_emotion':    emotion,
            'audio_emotion':    audio_preds[-1] if audio_preds else 'unknown',
            'video_emotion':    video_preds[-1] if video_preds else 'unknown',
            'fused_probs':      {EMOTIONS_7[i]: round(float(fused_list[i]), 4) for i in range(7)},
            'confidence':       round(confidence, 4),
            'emotional_stability': round(stability, 4),
            'stress_score':     round(stress_score, 4),
            'stress_label':     stress_label,
            'reasoning':        reasoning,
            'audio_temporal':   audio_preds,
            'video_temporal':   video_preds,
            **content,
        })

@flask_app.get('/history')
def get_history():
    limit = int(request.args.get('limit', 100))
    with get_db() as conn:
        rows = conn.execute('SELECT * FROM history ORDER BY timestamp DESC LIMIT ?', (limit,)).fetchall()
    return jsonify([dict(r) for r in rows])

@flask_app.delete('/history')
def clear_history():
    with get_db() as conn:
        conn.execute('DELETE FROM history')
        conn.commit()
    return jsonify({'ok': True})

@flask_app.get('/mappings')
def get_mappings():
    with get_db() as conn:
        rows = conn.execute('SELECT * FROM music_mappings').fetchall()
    return jsonify({r['emotion']: r['music_path'] for r in rows})

@flask_app.post('/mappings')
def save_mapping():
    data = request.json or {}
    emotion  = data.get('emotion')
    music    = data.get('music_path', '')
    if not emotion or emotion not in EMOTIONS_7:
        return jsonify({'error': 'Invalid emotion'}), 400
    with get_db() as conn:
        conn.execute('INSERT OR REPLACE INTO music_mappings (emotion, music_path) VALUES (?,?)', (emotion, music))
        conn.commit()
    return jsonify({'ok': True})

@flask_app.post('/analyze_history')
def analyze_history():
    data = request.json or {}
    history = data.get('history', [])
    api_key = data.get('groq_api_key') or GROQ_API_KEY
    if not history:
        return jsonify({'error': 'No data'}), 400
    summary = '\n'.join(
        f"- {r.get('timestamp','')}: {r.get('fused_emotion','?')} (stress: {r.get('stress_label','?')})"
        for r in history[:60])
    prompt = f"""You are an elite cognitive behavioral analyst reviewing a software developer's emotional history.

{summary}

Write a concise, empathetic 3-paragraph report covering:
1. Emotional trends observed
2. Notable stress patterns or recurring negatives
3. Two practical strategies to improve daily well-being

Make it professional yet warm. Do NOT use markdown. Start immediately."""
    result = call_groq(prompt, api_key=api_key)
    if result:
        return jsonify({'analysis': json.dumps(result) if isinstance(result, dict) else result})
    return jsonify({'analysis': 'Unable to generate analysis. Check your GROQ_API_KEY secret in HF Space settings.'})

@flask_app.post('/chat')
def chat():
    data    = request.json or {}
    message = data.get('message', '')
    history = data.get('history', [])
    emotion = data.get('emotion', 'neutral')
    api_key = data.get('groq_api_key') or GROQ_API_KEY
    if not message:
        return jsonify({'reply': 'Say something!'})
    msgs = [{'role': 'system', 'content': f'You are a compassionate workplace wellness assistant. The user\'s current emotional state is: {emotion}. Keep responses brief, warm, and practical.'}]
    for h in history[-6:]:
        msgs.append({'role': 'user',      'content': h.get('user', '')})
        msgs.append({'role': 'assistant', 'content': h.get('bot', '')})
    msgs.append({'role': 'user', 'content': message})
    try:
        use_key = api_key or GROQ_API_KEY
        resp = requests.post(GROQ_URL,
            headers={'Authorization': f'Bearer {use_key}', 'Content-Type': 'application/json'},
            json={'model': 'llama-3.3-70b-versatile', 'messages': msgs, 'temperature': 0.7, 'max_tokens': 300},
            timeout=20)
        if resp.status_code == 200:
            return jsonify({'reply': resp.json()['choices'][0]['message']['content'].strip()})
    except Exception as e:
        print(f'Chat error: {e}')
    return jsonify({'reply': 'Something went wrong. Please try again.'})

# ─────────────────────────────────────────────────────────────
# Gradio Status UI (shown at Space root)
# ─────────────────────────────────────────────────────────────
def build_gradio():
    with gr.Blocks(title='EmotionAI API', theme=gr.themes.Soft()) as demo:
        gr.Markdown("""
# 🧠 EmotionAI Backend
**REST API for the EmotionAI desktop application.**

This Space powers the emotion analysis backend. The Electron desktop app sends video/audio recordings here and receives back emotion classifications, stress scores, and personalized AI content.

---
### Available Endpoints
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/process` | Analyse face + voice, returns emotion + content |
| `GET` | `/history` | Fetch historical readings |
| `DELETE` | `/history` | Clear history |
| `GET` | `/mappings` | Get emotion→music mappings |
| `POST` | `/mappings` | Save mapping |
| `POST` | `/analyze_history` | AI trend report |
| `POST` | `/chat` | Chatbot |
| `GET` | `/health` | Status check |

---
> ⚙️ Set your `GROQ_API_KEY` in the **Settings → Variables and Secrets** of this Space for AI-powered responses.
""")
        status_btn = gr.Button('🔍 Check API Status')
        status_out = gr.JSON(label='API Status')

        def check_status():
            with flask_app.test_client() as c:
                r = c.get('/health')
                return r.get_json()

        status_btn.click(check_status, outputs=status_out)
    return demo

# ─────────────────────────────────────────────────────────────
# Launch: Flask in thread, Gradio on port 7860
# ─────────────────────────────────────────────────────────────
if __name__ == '__main__':
    # Run Flask on an internal port in a background thread
    FLASK_PORT = 5000
    flask_thread = threading.Thread(
        target=lambda: flask_app.run(host='127.0.0.1', port=FLASK_PORT, debug=False, use_reloader=False),
        daemon=True
    )
    flask_thread.start()
    print(f'[EmotionAI] Flask running internally on port {FLASK_PORT}')

    # Mount Flask onto Gradio's FastAPI app using WSGI middleware
    demo = build_gradio()

    # Mount the entire Flask app under the /api prefix
    # This ensures that ALL flask routes match /api/* (e.g. /api/history, /api/process)
    from starlette.middleware.wsgi import WSGIMiddleware
    demo.app.mount("/api", WSGIMiddleware(flask_app))

    # Also keep a dedicated health check at the root /health if needed, 
    # but the /api/health will be the primary one for Electron.
    demo.app.mount("/health", WSGIMiddleware(flask_app))

    # Launch with explicit network config for HF Spaces
    demo.launch(
        server_name='0.0.0.0',
        server_port=7860,
        share=False,
        show_error=True
    )
