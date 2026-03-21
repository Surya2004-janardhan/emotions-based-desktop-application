from flask import Flask, render_template, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
import cv2
import numpy as np
import librosa
import requests
import ffmpeg
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3' # Silence TensorFlow startup logs
from tensorflow import keras
import json
import sqlite3
from datetime import datetime
from uuid import uuid4
import tempfile

app = Flask(__name__)
CORS(app)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB limit for uploads

# Directories and Config
MUSIC_DIR = 'music'
os.makedirs(MUSIC_DIR, exist_ok=True)
EMOTIONS_7 = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgust', 'surprised']

DB_PATH = 'emotionai.db'

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    print("Initializing SQLite Database...")
    with get_db() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                fused_emotion TEXT,
                audio_emotion TEXT,
                video_emotion TEXT,
                confidence REAL,
                stability REAL,
                reasoning TEXT,
                stress_score REAL,
                stress_label TEXT
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS music_mappings (
                emotion TEXT PRIMARY KEY,
                music_path TEXT
            )
        ''')
        history_columns = {row['name'] for row in conn.execute("PRAGMA table_info(history)").fetchall()}
        if 'stress_score' not in history_columns:
            conn.execute('ALTER TABLE history ADD COLUMN stress_score REAL')
        if 'stress_label' not in history_columns:
            conn.execute('ALTER TABLE history ADD COLUMN stress_label TEXT')
        conn.commit()

init_db()

# Load models once at startup
print("Loading models...")
try:
    audio_model = keras.models.load_model('models/audio_emotion_model.h5')
    video_model = keras.models.load_model('models/video_emotion_model.h5')
    
    # Feature extractor for video
    base_cnn = keras.applications.MobileNetV2(weights='imagenet', include_top=False, input_shape=(112, 112, 3))
    base_cnn.trainable = False
    feature_extractor = keras.Sequential([
        base_cnn,
        keras.layers.GlobalAveragePooling2D()
    ])
    
    print("Models and feature extractor loaded successfully")
except Exception as e:
    print(f"Error loading models: {e}")
    audio_model = None
    video_model = None
    feature_extractor = None

# Initialize Groq client
# below trying to set env of groq
# GROQ_API_KEY 
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
# print("Groq client initialized", os.getenv("GROQ_API_KEY"))
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# Audio processing parameters
SR = 16000
WINDOW_SIZE = 0.025
HOP_SIZE = 0.01
N_MFCC = 13
HOP_LENGTH = 512
N_FRAMES = 300  # Number of time frames for MFCC features

# Video processing parameters
VIDEO_WINDOW_SIZE = 1  # seconds
TARGET_SIZE = (112, 112)
NUM_FRAMES = 10
FACE_CASCADE_PATH = os.path.join(cv2.data.haarcascades, 'haarcascade_frontalface_default.xml')
FACE_CASCADE = cv2.CascadeClassifier(FACE_CASCADE_PATH) if os.path.exists(FACE_CASCADE_PATH) else None

STRESS_BASELINE = {
    'happy': 0.15,
    'neutral': 0.25,
    'surprised': 0.45,
    'sad': 0.65,
    'disgust': 0.70,
    'fearful': 0.80,
    'angry': 0.85,
}

def estimate_stress_state(fused_emotion, emotional_stability, transition_rate):
    """Convert emotion dynamics into a coarse stress indicator for UI and coaching."""
    baseline = STRESS_BASELINE.get(fused_emotion or 'neutral', 0.35)
    stress_score = baseline + (0.2 * float(transition_rate)) + (0.1 * (1 - float(emotional_stability)))
    stress_score = float(np.clip(stress_score, 0.0, 1.0))

    if stress_score < 0.35:
        stress_label = 'low'
    elif stress_score < 0.65:
        stress_label = 'moderate'
    else:
        stress_label = 'high'

    return stress_score, stress_label

def build_fallback_memes(fused_emotion):
    meme_map = {
        'happy': [
            {'template': 'Success Kid', 'caption': 'When your meetings end on time and your coffee is still hot.', 'reason': 'Keeps the mood light and reinforces a positive work streak.'},
            {'template': 'Leonardo Cheers', 'caption': 'POV: You finished the sprint and nobody added surprise scope.', 'reason': 'Celebrates healthy momentum without making the advice feel heavy.'},
        ],
        'sad': [
            {'template': 'This Is Fine', 'caption': 'When the inbox grows faster than your energy, but you are still trying.', 'reason': 'Uses gentle humor to reduce emotional pressure during low phases.'},
            {'template': 'Grumpy Cat', 'caption': 'Me pretending I am okay with one more “quick” call at 6 PM.', 'reason': 'Helps the user feel seen instead of judged.'},
        ],
        'angry': [
            {'template': 'Distracted Boyfriend', 'caption': 'Me choosing deep breaths instead of replying instantly to that message.', 'reason': 'Reframes irritation into self-control with a familiar meme format.'},
            {'template': 'Woman Yelling at Cat', 'caption': 'My stress talking vs my actual to-do list.', 'reason': 'Turns escalation into perspective and release.'},
        ],
        'fearful': [
            {'template': 'Hide the Pain Harold', 'caption': 'When deadlines start staring back and you open another tab anyway.', 'reason': 'Softens anxiety with relatable workplace humor.'},
            {'template': 'Panik/Kalm', 'caption': 'Panik: too much work. Kalm: one task at a time.', 'reason': 'Supports grounding through simple contrast.'},
        ],
        'disgust': [
            {'template': 'Nope Octopus', 'caption': 'When your brain rejects the whole workflow and asks for a reset.', 'reason': 'Acknowledges overload and boundary fatigue.'},
            {'template': 'Side Eye Puppet', 'caption': 'That look when another “urgent” task appears with no context.', 'reason': 'Lets the user laugh at workplace friction instead of absorbing it.'},
        ],
        'surprised': [
            {'template': 'Surprised Pikachu', 'caption': 'When the “small fix” turns into a full afternoon.', 'reason': 'Turns unexpected workload spikes into something playful.'},
            {'template': 'Wait, What?', 'caption': 'My face when the calendar says free but the reality says otherwise.', 'reason': 'Matches sudden change in the emotional pattern.'},
        ],
        'neutral': [
            {'template': 'Drake Hotline Bling', 'caption': 'Ignoring chaos, choosing a steady pace.', 'reason': 'Supports calm and sustainable work rhythm.'},
            {'template': 'Office Jim Look', 'caption': 'When you survive the day by staying quietly balanced.', 'reason': 'Keeps neutral states engaging instead of flat.'},
        ],
    }
    return meme_map.get(fused_emotion, meme_map['neutral'])

def extract_mfcc(audio_path):
    """Extract MFCC features from audio file using optimized batch processing."""
    try:
        # Load audio using librosa
        y, sr = librosa.load(audio_path, sr=SR, mono=True)
        if len(y) == 0:
            raise ValueError("Empty audio")

        # Compute MFCC for the entire audio clip at once (Massive speedup)
        # We target the same window/hop structure as before but computed globally
        # N_MFCC=13, HOP_LENGTH=512
        full_mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=N_MFCC, hop_length=HOP_LENGTH)
        full_mfcc = full_mfcc.T # (Time, N_MFCC)

        # Calculate how many MFCC frames correspond to our window/hop in seconds
        # window_samples / hop_length = frames_per_window
        window_frames = int((WINDOW_SIZE * sr) / HOP_LENGTH)
        hop_frames = int((HOP_SIZE * sr) / HOP_LENGTH)
        
        # Ensure window_frames is at least 1
        window_frames = max(1, window_frames)
        hop_frames = max(1, hop_frames)

        mfcc_windows = []
        # Slice the pre-computed MFCC into windows
        for start in range(0, full_mfcc.shape[0] - window_frames + 1, hop_frames):
            end = start + window_frames
            mfcc_slice = full_mfcc[start:end]

            # Pad or truncate to N_FRAMES
            if mfcc_slice.shape[0] < N_FRAMES:
                mfcc_slice = np.pad(mfcc_slice, ((0, N_FRAMES - mfcc_slice.shape[0]), (0, 0)), mode='constant')
            else:
                mfcc_slice = mfcc_slice[:N_FRAMES]

            mfcc_windows.append(mfcc_slice[..., np.newaxis])

        # Fallback if no windows were created
        if len(mfcc_windows) == 0:
            mfcc_slice = full_mfcc
            if mfcc_slice.shape[0] < N_FRAMES:
                mfcc_slice = np.pad(mfcc_slice, ((0, N_FRAMES - mfcc_slice.shape[0]), (0, 0)), mode='constant')
            else:
                mfcc_slice = mfcc_slice[:N_FRAMES]
            mfcc_windows.append(mfcc_slice[..., np.newaxis])

        return np.array(mfcc_windows)
    except Exception as e:
        print(f"Failed to extract MFCC: {e}")
        return None

def generate_llm_content(fused_emotion, reasoning, audio_temporal, video_temporal):
    """Generate personalized stress-support content using Groq LLM."""
    prompt = f"""
You are helping a laptop-based employee understand stress patterns using emotion analysis over time.

Based on the temporal emotion shifts below:

Primary Emotion Detected: {fused_emotion}
Stress and Temporal Summary: {reasoning}
Audio Emotional Timeline: {', '.join(audio_temporal)}
Video Emotional Timeline: {', '.join(video_temporal)}

Please generate highly personalized support content in SIMPLE ENGLISH.
You MUST return a valid JSON object with the following structure:

{{
  "story": "A short, calming reflection (STRICTLY 90-110 WORDS) that explains the user's emotional or stress pattern gently in simple English.",
  "quote": "A short encouraging quote tailored to this stress pattern.",
  "video": {{
    "title": "Video Title",
    "channel": "Channel Name",
    "link": "https://www.youtube.com/results?search_query=...",
    "reason": "Why this video matters for this emotional state."
  }},
  "books": [
    {{
      "title": "Book Title",
      "author": "Author Name",
      "reason": "Why it resonates.",
      "purchase_link": "https://www.google.com/search?q=buy+book+..."
    }}
  ],
  "songs": [
    {{
      "artist": "Artist 1",
      "title": "Song 1",
      "explanation": "Why it helps with this stress pattern."
    }},
    {{
      "artist": "Artist 2",
      "title": "Song 2",
      "explanation": "Why it helps with this stress pattern."
    }},
    {{
      "artist": "Artist 3",
      "title": "Song 3",
      "explanation": "Why it helps with this stress pattern."
    }}
  ],
  "memes": [
    {{
      "template": "Meme Template Name",
      "caption": "A light, office-friendly meme caption based on the user's current stress or emotion pattern.",
      "reason": "Why this meme suits the user right now."
    }}
  ]
}}

Ensure the story is STRICTLY 90-110 words.
You MUST provide EXACTLY 3 song recommendations. 
You MUST provide EXACTLY 2 meme suggestions.
Keep the tone warm, practical, and not clinical.
Return ONLY the JSON object.
"""
    try:
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        data = {
            "model": "llama-3.3-70b-versatile",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
            "max_tokens": 1024
        }
        response = requests.post(GROQ_URL, headers=headers, json=data)
        if response.status_code == 200:
            try:
                raw_json_res = response.json()
                content = raw_json_res['choices'][0]['message']['content'].strip()
                
                # Clean up JSON formatting
                if content.startswith('```json'):
                    content = content[7:]
                if content.endswith('```'):
                    content = content[:-3]
                content = content.strip()
                
                llm_dict = json.loads(content)
                
                # Hardening: Merge with fallback if keys are missing
                fallback = generate_fallback_content(fused_emotion)
                for key in ['story', 'quote', 'video', 'books', 'songs', 'memes']:
                    if not llm_dict.get(key):
                        llm_dict[key] = fallback.get(key)
                
                return llm_dict
            except Exception as e:
                print(f"LLM JSON failure: {e}")
                return generate_fallback_content(fused_emotion)
        else:
            return generate_fallback_content(fused_emotion)
    except Exception as e:
        print(f"LLM error: {e}")
        return generate_fallback_content(fused_emotion)

def generate_fallback_content(fused_emotion):
    """Generate sophisticated fallback content when LLM fails."""
    fallbacks = {
        'happy': {
            'story': 'The sun seems to hang a little longer in the sky today, casting a golden glow over everything you touch. There is a rhythmic pulse to the air, a steady heartbeat that matches the quiet confidence growing within your chest. You are moving through the world with a certain grace, a fluid dance that speaks of a soul in perfect harmony with its surroundings. Every breath brings a fresh perspective, a new reason to smile at the simple wonders of existence. This is your time to shine, a beautiful chapter written in the language of light and unspoken peace, where every moment is a precious gift to be cherished deeply.',
            'quote': '"To be happy is to be able to become aware of oneself without fright." — Walter Benjamin',
            'video': {'title': 'The Science of Happiness', 'channel': 'SoulPancake', 'link': 'https://youtu.be/GXy__kBVq1M', 'reason': 'A deep dive into the neurological foundations of joy.'},
            'books': [{'title': 'The Happiness Project', 'author': 'Gretchen Rubin', 'reason': 'Practical strategies for cultivating daily joy.', 'purchase_link': 'https://www.google.com/search?q=The+Happiness+Project+Gretchen+Rubin+buy'}, {'title': 'Flow', 'author': 'Mihaly Csikszentmihalyi', 'reason': 'Understanding the psychology of optimal experience.', 'purchase_link': 'https://www.google.com/search?q=Flow+Mihaly+Csikszentmihalyi+buy'}],
            'songs': [
                {'artist': 'Pharrell Williams', 'title': 'Happy', 'explanation': 'An anthem of pure, unadulterated joy.'},
                {'artist': 'Coldplay', 'title': 'A Sky Full of Stars', 'explanation': 'A vibrant sonic landscape matching elevated emotional states.'},
                {'artist': 'Katrina & The Waves', 'title': 'Walking on Sunshine', 'explanation': 'Radiant rhythmic energy to reinforce positive momentum.'}
            ]
        },
        'sad': {
            'story': 'A soft rain falls upon the garden of your mind, nourishing the seeds of a deeper wisdom that only growth through stillness can bring. There is a quiet strength in this pause, a gentle invitation to simply be without the need for constant movement or noise. You are navigating a vast and winding landscape, where every turn offers a moment of reflection and a chance to rediscover your own resilient spirit. Like the moon pulling the tides, your current path is part of a grander cycle, one that promises a slow and steady return to the warmth of the sun eventually. Trust in your own inner depth and the power.',
            'quote': '"There is no greater sorrow than to recall in misery the time when we were happy." — Dante Alighieri',
            'video': {'title': 'The Philosophy of Sadness', 'channel': 'The School of Life', 'link': 'https://www.youtube.com/results?search_query=philosophy+of+sadness', 'reason': 'Understanding the value of melancholic reflection.'},
            'books': [{'title': 'The Noonday Demon', 'author': 'Andrew Solomon', 'reason': 'A comprehensive look at the anatomy of sadness.', 'purchase_link': 'https://www.google.com/search?q=The+Noonday+Demon+Andrew+Solomon+buy'}, {'title': 'Year of Magical Thinking', 'author': 'Joan Didion', 'reason': 'A masterpiece on grief and resilience.', 'purchase_link': 'https://www.google.com/search?q=Year+of+Magical+Thinking+Joan+Didion+buy'}],
            'songs': [
                {'artist': 'Adele', 'title': 'Someone Like You', 'explanation': 'A powerful exploration of loss and longing.'},
                {'artist': 'Gary Jules', 'title': 'Mad World', 'explanation': 'A hauntingly beautiful reflection on the complexities of life.'},
                {'artist': 'Radiohead', 'title': 'No Surprises', 'explanation': 'Gentle, melancholic textures for introspective processing.'}
            ]
        },
        'angry': {
            'story': 'A powerful storm gathers on the horizon, crackling with a high electricity that demands as much respect as it does attention today. This intense energy is an ocean of untapped potential, a roaring fire that can either consume everything or forge something completely new and strong. You are standing at the center of this whirlwind, a pillar of focus in a world that often feels too small for your grander vision. Channels this heat into a steady purpose, letting the lightning clear the path for the transformation you truly seek. You possess the inner strength to turn this fierce moment into a legacy of bold action and unwavering inner conviction.',
            'quote': '"For every minute you are angry you lose sixty seconds of happiness." — Ralph Waldo Emerson',
            'video': {'title': 'Understanding Anger', 'channel': 'Mindful', 'link': 'https://www.youtube.com/results?search_query=understanding+anger+psychology', 'reason': 'Neurological insights into the response of anger.'},
            'books': [{'title': 'Rage Becomes Her', 'author': 'Soraya Chemaly', 'reason': 'The power of anger as a catalyst for change.', 'purchase_link': 'https://www.google.com/search?q=Rage+Becomes+Her+Soraya+Chemaly+buy'}],
            'songs': [
                {'artist': 'Rage Against The Machine', 'title': 'Killing In The Name', 'explanation': 'A raw expression of defiance and boundary setting.'},
                {'artist': 'The White Stripes', 'title': 'Seven Nation Army', 'explanation': 'A driving rhythm to channel intense focus and drive.'},
                {'artist': 'Linkin Park', 'title': 'In The End', 'explanation': 'A rhythmic release for complex emotional tension.'}
            ]
        },
        'fearful': {
            'story': 'The world feels suddenly vast and unfamiliar, like a dense fog that has rolled in from the silent and deep sea. In this state of heightened awareness, even the smallest whisper seems to carry a heavy weight of mystery and hidden secrets. You are like a careful explorer charting an unknown continent, every step a testament to your quiet courage and your deep-seated will to thrive. This moment of caution is not a weakness but a sharp and vital survival instinct, a bridge leading you toward a place of greater safety and understanding. Trust your path, for your inner light is burning bright today across the entire winding landscape now.',
            'quote': '"The only thing we have to fear is fear itself." — Franklin D. Roosevelt',
            'video': {'title': 'The Science of Fear', 'channel': 'Vsauce', 'link': 'https://www.youtube.com/results?search_query=science+of+fear', 'reason': 'A fascinating look at why we experience fear.'},
            'books': [{'title': 'Feel the Fear and Do It Anyway', 'author': 'Susan Jeffers', 'reason': 'Converting fear into power and action.', 'purchase_link': 'https://www.google.com/search?q=Feel+the+Fear+and+Do+It+Anyway+buy'}],
            'songs': [
                {'artist': 'Florence + The Machine', 'title': 'Shake It Out', 'explanation': 'A song about releasing the grip of internal fears.'},
                {'artist': 'Enya', 'title': 'Storms in Africa', 'explanation': 'Calming, rhythmic grounding for a state of high alert.'},
                {'artist': 'London Grammar', 'title': 'Strong', 'explanation': 'A haunting melody that reinforces innate internal power.'}
            ]
        },
        'surprised': {
            'story': 'A sudden burst of color explodes across your vision, like a meteor trailing sparks through a midnight sky of deep blue and silver. This unexpected moment of pure wonder has redirected your focus, pulling you into a state of vibrant curiosity and profound sensory delight. You are moving through a world that still holds the capacity to startle and amaze, a place where the ordinary can transform into the extraordinary in the blink of an eye. Embrace this high energy, this sudden peak of novelty that reminds you how much there is left to discover. Your spirit remains beautifully open to the magic of surprise within the entire human experience.',
            'quote': '"The world is full of magical things, patiently waiting for our senses to grow sharper." — W.B. Yeats',
            'video': {'title': 'The Psychology of Surprise', 'channel': 'Enlightenment', 'link': 'https://www.youtube.com/results?search_query=psychology+of+surprise', 'reason': 'Exploring the cognitive impact of the unexpected.'},
            'books': [{'title': 'Stumbling on Happiness', 'author': 'Daniel Gilbert', 'reason': 'Insight into how our brains perceive the future.', 'purchase_link': 'https://www.google.com/search?q=Stumbling+on+Happiness+Daniel+Gilbert+buy'}],
            'songs': [
                {'artist': 'Radiohead', 'title': 'Everything In Its Right Place', 'explanation': 'A sonic journey through unexpected shifts in perspective.'},
                {'artist': 'MGMT', 'title': 'Electric Feel', 'explanation': 'An upbeat, surprising rhythmic encounter for the senses.'},
                {'artist': 'Glass Animals', 'title': 'Heat Waves', 'explanation': 'Atmospheric shifts that match cognitive novelty.'}
            ]
        },
        'disgust': {
            'story': 'You have reached a clear and definite edge, a boundary of the soul that demands deep respect and unwavering internal alignment today. This visceral sense of clarity is a gift, a shield that protects the sanctity of your character and the purity of your path. You are like a diamond that remains untouched by the dust, a spirit that knows exactly where it ends and where the rest of the world begins. Trust this powerful discernment, for it is the voice of your own integrity speaking a truth that is both firm and necessary. You are charting a course that is authentically yours, free from common shadows and external static.',
            'quote': '"Disgust is the visceral realization that we have a standard." — Anonymous',
            'video': {'title': 'How Emotions Work', 'channel': 'Kurzgesagt', 'link': 'https://youtu.be/SJOjpprbfMo', 'reason': 'Understanding the evolutionary roots of all emotions.'},
            'books': [{'title': 'Radical Acceptance', 'author': 'Tara Brach', 'reason': 'Embracing life with compassion.', 'purchase_link': 'https://www.google.com/search?q=Radical+Acceptance+Tara+Brach+buy'}, {'title': 'The Upside of Your Dark Side', 'author': 'Todd Kashdan', 'reason': 'Finding value in uncomfortable emotions.', 'purchase_link': 'https://www.google.com/search?q=The+Upside+of+Your+Dark+Side+buy'}],
            'songs': [
                {'artist': 'Britney Spears', 'title': 'Toxic', 'explanation': 'Recognizing and safely distancing from the disagreeable.'},
                {'artist': 'Lorde', 'title': 'Royals', 'explanation': 'A grounded disdain for the superficial and excessive.'},
                {'artist': 'Billie Eilish', 'title': 'Bad Guy', 'explanation': 'A rhythmic declaration of autonomy and boundaries.'}
            ]
        },
        'neutral': {
            'story': 'A steady river flows through the quiet valley of your consciousness, reflecting the vast and open sky with perfect, mirror-like clarity today. There is a profound peace in this equilibrium, a balanced state where every breath is a synchronized and rhythmic celebration of the present moment. You are standing on solid ground, a center of calm in a world that is constantly shifting and turning. This internal harmony is a foundation of strength, a reservoir of poised resilience that allows you to move with quiet grace and absolute focus. Embrace this stillness, for it is the powerful baseline that supports your entire journey across the rolling tides and unfolding light.',
            'quote': '"Nothing diminishes anxiety faster than action." — Walter Richard Sickert',
            'video': {'title': 'The Art of Neutrality', 'channel': 'TED', 'link': 'https://www.youtube.com/results?search_query=art+of+mindfulness+neutrality', 'reason': 'Finding balance in a chaotic world.'},
            'books': [{'title': 'The Power of Now', 'author': 'Eckhart Tolle', 'reason': 'A guide to spiritual enlightenment and presence.', 'purchase_link': 'https://www.google.com/search?q=The+Power+of+Now+buy'}],
            'songs': [
                {'artist': 'Enya', 'title': 'Only Time', 'explanation': 'A serene and timeless reflection on life.'},
                {'artist': 'Bon Iver', 'title': 'Holocene', 'explanation': 'Grounding, expansive textures for a balanced state of being.'},
                {'artist': 'Ludovico Einaudi', 'title': 'Nuvole Bianche', 'explanation': 'A pure piano composition for focused, quiet resonance.'}
            ]
        }
    }
    selected = dict(fallbacks.get(fused_emotion, fallbacks['neutral']))
    selected['memes'] = build_fallback_memes(fused_emotion)
    return selected

def sample_frames(video_path):
    """Sample frame sequences from video over time with fallback for missing metadata."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"ERROR: Could not open video file {video_path}")
        return None

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Fallback for WebM/missing metadata
    if total_frames <= 0 or fps <= 0:
        print("WEB_METADATA_MISSING: Counting frames manually...")
        count = 0
        while True:
            ret, _ = cap.read()
            if not ret: break
            count += 1
        total_frames = count
        fps = 30 # Assumption if missing
        cap.release()
        cap = cv2.VideoCapture(video_path) # Re-open for sampling
    
    duration = total_frames / fps if fps > 0 else 0
    print(f"Video Stats: {total_frames} frames, {fps} FPS, {duration:.2f}s duration")

    if total_frames == 0:
        cap.release()
        return None

    # Sample sequences every VIDEO_WINDOW_SIZE seconds
    sequences = []
    window_frames = max(1, int(VIDEO_WINDOW_SIZE * fps))
    hop_frames = max(1, int(VIDEO_WINDOW_SIZE * fps / 2))
    
    for start_frame in range(0, total_frames - window_frames + 1, hop_frames):
        end_frame = start_frame + window_frames
        frames = []
        
        # Select NUM_FRAMES from this window
        step = max(1, window_frames // NUM_FRAMES)
        for frame_idx in range(start_frame, end_frame, step):
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if ret:
                frame = cv2.resize(frame, TARGET_SIZE) / 255.0
                frames.append(frame)
            if len(frames) == NUM_FRAMES:
                break
        
        if len(frames) == NUM_FRAMES:
            sequences.append(np.array(frames))
    
    cap.release()
    return np.array(sequences) if sequences else None

def detect_human_face_in_video(video_path, max_checks=24, min_hits=2):
    """Safety gate: return True only if a human face is detected in uploaded content."""
    if FACE_CASCADE is None:
        print("Face cascade unavailable. Skipping strict face gate.")
        return True, 0

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return False, 0

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    if total_frames <= 0:
        cap.release()
        return False, 0

    sample_count = min(max_checks, total_frames)
    frame_indices = np.linspace(0, max(0, total_frames - 1), sample_count).astype(int)
    hits = 0

    for idx in frame_indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
        ok, frame = cap.read()
        if not ok or frame is None:
            continue
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = FACE_CASCADE.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(40, 40),
        )
        if len(faces) > 0:
            hits += 1
            if hits >= min_hits:
                cap.release()
                return True, hits

    cap.release()
    return False, hits

DEFAULT_PROGRESS_STATE = {"progress": 0, "status": "Ready", "results": None}
progress_states = {}

def init_job(job_id):
    progress_states[job_id] = dict(DEFAULT_PROGRESS_STATE)
    return progress_states[job_id]

def update_job(job_id, *, progress=None, status=None, results=None):
    state = progress_states.setdefault(job_id, dict(DEFAULT_PROGRESS_STATE))
    if progress is not None:
        state["progress"] = progress
    if status is not None:
        state["status"] = status
    if results is not None:
        state["results"] = results
    return state

@app.route('/status', methods=['GET'])
def get_status():
    job_id = request.args.get('job_id')
    if not job_id:
        return jsonify(DEFAULT_PROGRESS_STATE)
    return jsonify(progress_states.get(job_id, dict(DEFAULT_PROGRESS_STATE)))

@app.route('/process', methods=['POST'])
def process():
    job_id = request.form.get('job_id') or str(uuid4())
    progress_state = init_job(job_id)
    update_job(job_id, progress=0, status="Initializing", results=None)
    
    print("=" * 50)
    print("STARTING EMOTION ANALYSIS PROCESS")
    print("=" * 50)

    if video_model is None or feature_extractor is None:
        print("ERROR: Models not loaded")
        return jsonify({'error': 'Models not loaded'})

    try:
        # Save uploaded video file (per-job unique temp paths to avoid collisions)
        video_file = request.files['video']
        tmp_dir = tempfile.gettempdir()
        raw_video_path = os.path.join(tmp_dir, f'emotionai_{job_id}_raw.webm')
        video_path = os.path.join(tmp_dir, f'emotionai_{job_id}_norm.mp4')
        audio_path = os.path.join(tmp_dir, f'emotionai_{job_id}_audio.wav')
        
        print(f"Saving raw video to {raw_video_path}")
        video_file.save(raw_video_path)

        # 1. Normalize Video using FFmpeg (Fixes WebM headers for OpenCV)
        update_job(job_id, status="Normalizing Video", progress=5)
        print("Normalizing video container...")
        ffmpeg_bin = os.path.join(os.getcwd(), 'ffmpeg.exe') if os.path.exists('ffmpeg.exe') else 'ffmpeg'
        try:
            (
                ffmpeg
                .input(raw_video_path)
                .output(video_path, vcodec='libx264', acodec='aac', strict='experimental')
                .overwrite_output()
                .run(cmd=ffmpeg_bin, quiet=True)
            )
            print("Video normalized successfully")
        except Exception as e:
            print(f"Video normalization failed: {e}")
            for path in [raw_video_path]:
                if path and os.path.exists(path):
                    os.remove(path)
            update_job(job_id, progress=100, status="Error: unable to normalize video", results=None)
            return jsonify({
                'error': 'Unable to decode recorded video stream. Please retry with stable camera input.',
                'job_id': job_id
            })

        # 1.5 Safety Gate: proceed only if a human face is present.
        update_job(job_id, status="Validating Human Presence", progress=8)
        has_face, face_hits = detect_human_face_in_video(video_path)
        if not has_face:
            print(f"FACE_GATE_REJECTED: No valid human face detected (hits={face_hits}).")
            for path in [raw_video_path, video_path, audio_path]:
                if path and os.path.exists(path):
                    os.remove(path)
            update_job(job_id, progress=100, status="Rejected: no human face detected", results=None)
            return jsonify({
                'error': 'No clear human face detected in the recording. Please ensure your face is visible and try again.',
                'job_id': job_id
            })

        # 2. Extract audio from video
        update_job(job_id, status="Extracting Audio", progress=10)
        print("Extracting audio from video...")
        try:
            (
                ffmpeg
                .input(video_path)
                .output(audio_path, acodec='pcm_s16le', ac=1, ar='16000')
                .overwrite_output()
                .run(cmd=ffmpeg_bin, quiet=True)
            )
            print("Audio extracted successfully")
        except Exception as e:
            print(f"Audio extraction failed: {e}")
            audio_path = None

        # --- UNIFIED TEMPORAL PROCESSING ---
        update_job(job_id, status="Initializing Multimodal Streams", progress=12)
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps > 0 else 0
        
        # Audio Modality Engine Setup
        y_audio, sr_audio = (None, None)
        if audio_path and os.path.exists(audio_path):
            print("Audio Modality Engine: Loading stream...")
            update_job(job_id, status="Loading Audio Stream")
            try:
                y_audio, sr_audio = librosa.load(audio_path, sr=SR, mono=True)
                print(f"Audio loaded: {len(y_audio)/SR:.2f}s at {SR}Hz")
            except Exception as e:
                print(f"Audio Load Error: {e}")

        # Create overlapping 1s windows (every 0.5s)
        time_points = np.arange(0, max(0.1, duration - 1.0), 0.5)
        video_batch = []
        audio_batch = []
        
        total_segments = len(time_points)
        print(f"Synthesizing {total_segments} temporal segments...")
        
        # 1. Video Modality Segment Extraction
        print(f"Video Modality Engine: Sampling {total_segments} facial sequences...")
        for i, t in enumerate(time_points):
            update_job(
                job_id,
                status=f"Video Modality: Mapping Facial Dynamics ({i+1}/{total_segments})",
                progress=15 + int((i / total_segments) * 20)
            )
            
            start_f = int(t * fps)
            end_f = int((t + 1) * fps)
            seq = []
            step = max(1, (end_f - start_f) // NUM_FRAMES)
            for f_idx in range(start_f, min(total_frames, end_f), step):
                cap.set(cv2.CAP_PROP_POS_FRAMES, f_idx)
                ret, frame = cap.read()
                if ret:
                    seq.append(cv2.resize(frame, TARGET_SIZE) / 255.0)
                if len(seq) == NUM_FRAMES: break
            
            while len(seq) < NUM_FRAMES:
                seq.append(np.zeros((*TARGET_SIZE, 3)))
            video_batch.append(np.array(seq))
            
            if i % 10 == 0 or i == total_segments - 1:
                print(f"  [Video] Mapping segment {i+1}/{total_segments}...")

        cap.release()

        # 2. Audio Modality Segment Extraction (MFCC)
        if y_audio is not None:
            print(f"Audio Modality Engine: Synthesizing {total_segments} acoustic patterns...")
            for i, t in enumerate(time_points):
                update_job(
                    job_id,
                    status=f"Audio Modality: Synthesizing Vocal Arc ({i+1}/{total_segments})",
                    progress=35 + int((i / total_segments) * 15)
                )
                
                as_start = int(t * SR)
                as_end = int((t + 1) * SR)
                y_segment = y_audio[as_start:as_end]
                
                m_feat = librosa.feature.mfcc(y=y_segment, sr=SR, n_mfcc=N_MFCC, hop_length=HOP_LENGTH).T
                if m_feat.shape[0] < N_FRAMES:
                    m_feat = np.pad(m_feat, ((0, N_FRAMES - m_feat.shape[0]), (0, 0)), mode='constant')
                else:
                    m_feat = m_feat[:N_FRAMES]
                audio_batch.append(m_feat[..., np.newaxis])
                
                if i % 10 == 0 or i == total_segments - 1:
                    print(f"  [Audio] Processing segment {i+1}/{total_segments}...")

        # BATCH INFERENCE
        video_preds = []
        audio_preds = []
        
        if video_batch:
            update_job(job_id, status="Neural Video Inference: Running Batch", progress=50)
            print("Neural Engine: Running video batch inference...")
            v_batch = np.array(video_batch) # (N, 10, 112, 112, 3)
            # Flatten to extract features
            v_flat = v_batch.reshape(-1, 112, 112, 3)
            v_features = feature_extractor.predict(v_flat, batch_size=32, verbose=0)
            # Reshape back and pool
            v_seq_feat = v_features.reshape(len(time_points), NUM_FRAMES, -1)
            v_input = np.mean(v_seq_feat, axis=1)
            video_preds = video_model.predict(v_input, verbose=0)
            print(f"Neural Engine: Video predictions generated for {len(video_preds)} segments")
            
        if audio_batch:
            update_job(job_id, status="Neural Audio Inference: Running Batch", progress=70)
            print("Neural Engine: Running audio batch inference...")
            a_input = np.array(audio_batch) # (N, 300, 13, 1)
            audio_preds = audio_model.predict(a_input, batch_size=32, verbose=0)
            print(f"Neural Engine: Audio predictions generated for {len(audio_preds)} segments")

        update_job(job_id, progress=85, status="Cognitive Synthesis Layer")
        print("Cognitive Layer: Analyzing multimodal temporal patterns...")

        audio_emotions_temporal = [EMOTIONS_7[np.argmax(p)] for p in audio_preds] if len(audio_preds) > 0 else []
        video_emotions_temporal = [EMOTIONS_7[np.argmax(p)] for p in video_preds] if len(video_preds) > 0 else []

        # TIMELINE-BASED EMOTION DETERMINATION
        from collections import Counter
        combined_emotions = []
        if audio_emotions_temporal and video_emotions_temporal:
            # Equal length guaranteed by time_points
            combined_emotions = video_emotions_temporal 
        elif video_emotions_temporal:
            combined_emotions = video_emotions_temporal
        elif audio_emotions_temporal:
            combined_emotions = audio_emotions_temporal
        else:
            combined_emotions = ["neutral"]

        emotion_counts = Counter(combined_emotions)
        total_predictions = len(combined_emotions)
        timeline_dominant_emotion = emotion_counts.most_common(1)[0][0]
        timeline_confidence = emotion_counts.most_common(1)[0][1] / total_predictions
        unique_emotions = len(emotion_counts)
        emotional_stability = 1.0 - (unique_emotions - 1) / len(EMOTIONS_7)
        transitions = sum(1 for i in range(1, len(combined_emotions)) if combined_emotions[i] != combined_emotions[i-1])
        transition_rate = transitions / max(1, len(combined_emotions) - 1)
        stress_score, stress_label = estimate_stress_state(
            timeline_dominant_emotion,
            emotional_stability,
            transition_rate
        )

        # COGNITIVE LAYER ANALYSIS
        reasoning_parts = []
        if timeline_confidence > 0.7:
            reasoning_parts.append(f"Strong emotional consistency: {timeline_dominant_emotion} in {timeline_confidence*100:.1f}%")
        else:
            reasoning_parts.append(f"Mixed state: {timeline_dominant_emotion} leads at {timeline_confidence*100:.1f}%")
        
        if emotional_stability > 0.8: reasoning_parts.append("High stability.")
        elif emotional_stability > 0.6: reasoning_parts.append("Moderate stability.")
        else: reasoning_parts.append("Low stability.")
        reasoning_parts.append(f"Estimated stress level is {stress_label}.")

        cognitive_reasoning = " ".join(reasoning_parts)
        update_job(job_id, progress=90, status="Generating AI Response")

        # AI LAYER
        llm_content = generate_llm_content(
            timeline_dominant_emotion,
            cognitive_reasoning,
            audio_emotions_temporal,
            video_emotions_temporal
        )

        # Build probability arrays for smooth temporal charts
        audio_probs = audio_preds.tolist() if len(audio_preds) > 0 else []
        video_probs = video_preds.tolist() if len(video_preds) > 0 else []

        final_result = {
            'audio_emotion': Counter(audio_emotions_temporal).most_common(1)[0][0] if audio_emotions_temporal else None,
            'video_emotion': timeline_dominant_emotion,
            'fused_emotion': timeline_dominant_emotion,
            'reasoning': cognitive_reasoning,
            'story': llm_content.get('story', ''),
            'quote': llm_content.get('quote', ''),
            'video': llm_content.get('video', ''),
            'books': llm_content.get('books', []),
            'songs': llm_content.get('songs', []),
            'memes': llm_content.get('memes', []),
            'audio_temporal': audio_emotions_temporal,
            'video_temporal': video_emotions_temporal,
            'audio_probs_temporal': audio_probs,
            'video_probs_temporal': video_probs,
            'time_points': list(range(len(combined_emotions))),
            'timeline_confidence': float(timeline_confidence),
            'emotional_stability': float(emotional_stability),
            'transition_rate': float(transition_rate),
            'emotion_distribution': dict(emotion_counts),
            'stress_score': stress_score,
            'stress_label': stress_label,
        }

        # Clean up
        for path in [raw_video_path, video_path, audio_path]:
            if path and os.path.exists(path): os.remove(path)

        # Log history to DB
        try:
            with get_db() as conn:
                conn.execute('''
                    INSERT INTO history (fused_emotion, audio_emotion, video_emotion, confidence, stability, reasoning, stress_score, stress_label)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    final_result.get('fused_emotion'),
                    final_result.get('audio_emotion'),
                    final_result.get('video_emotion'),
                    final_result.get('timeline_confidence', 0),
                    final_result.get('emotional_stability', 0),
                    final_result.get('reasoning'),
                    final_result.get('stress_score', 0),
                    final_result.get('stress_label', 'moderate'),
                ))
                conn.commit()
        except Exception as db_err:
            print(f"Error logging to DB: {db_err}")

        final_result['job_id'] = job_id
        update_job(job_id, progress=100, status="Complete", results=final_result)
        return jsonify(final_result)

    except Exception as e:
        # Best-effort cleanup of per-job temp artifacts
        try:
            tmp_dir = tempfile.gettempdir()
            for suffix in ['_raw.webm', '_norm.mp4', '_audio.wav']:
                candidate = os.path.join(tmp_dir, f'emotionai_{job_id}{suffix}')
                if os.path.exists(candidate):
                    os.remove(candidate)
        except Exception:
            pass
        update_job(job_id, status=f"Error: {str(e)}")
        return jsonify({'error': str(e), 'job_id': job_id})

@app.route('/downloaded_music/<path:filename>')
def serve_music(filename):
    """Serve cached music files from the music/ directory."""
    return send_from_directory('music', filename)

@app.route('/music/search', methods=['GET'])
def music_search():
    """Search music for a song, cache it locally, and return local stream URL."""
    try:
        q = request.args.get('q', 'Lofi Study')
        if not q:
            return jsonify({'error': 'No query provided'}), 400
            
        print(f"Music Engine: Searching for -> {q}")
        
        # 1. Search for song using saavn.sumit.co API
        search_url = f"https://saavn.sumit.co/api/search/songs?query={requests.utils.quote(q)}"
        try:
            r = requests.get(search_url, timeout=15)
            r.raise_for_status()
            search_data = r.json()
            results = search_data.get('data', {}).get('results', [])
            if not results:
                return jsonify({'error': 'No results found'}), 404
            
            top_song = results[0]
            song_id = top_song.get('id')
            title = top_song.get('name', 'Unknown')
            # Extract high quality download link (usually last in list)
            download_links = top_song.get('downloadUrl', [])
            stream_url = download_links[-1].get('url') if download_links else None
            
            if not stream_url:
                return jsonify({'error': 'No stream URL available'}), 404
                
            # Improved Metadata extraction
            artist = top_song.get('artists', {}).get('primary', [{}])[0].get('name', 'Various Artists')
            # Get high res image (usually last)
            images = top_song.get('image', [])
            album_art = images[-1].get('url') if images else ''
            duration = int(top_song.get('duration', 0))

        except Exception as e:
            print(f"Music Engine Search Error: {e}")
            return jsonify({'error': 'Search service unavailable'}), 503

        # 2. Caching logic - Sanitize name for Windows/Filesystem
        filename = "".join([c if c.isalnum() else "_" for c in f"{song_id}_{title}"[:50]]) + ".mp3"
        filepath = os.path.join(MUSIC_DIR, filename)

        if not os.path.exists(filepath):
            print(f"Music Engine: Caching new file -> {filename}")
            try:
                # Use a proper User-Agent to avoid blocks during download
                headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
                audio_data = requests.get(stream_url, headers=headers, timeout=30).content
                with open(filepath, 'wb') as f:
                    f.write(audio_data)
                print(f"Music Engine: Cache successful.")
            except Exception as e:
                print(f"Music Engine Download Error: {e}")
                # Don't fail entirely, just return the remote URL if caching fails
                return jsonify({
                    'title': title,
                    'artist': artist,
                    'preview': stream_url, 
                    'album_art': album_art,
                    'duration': duration,
                })
        else:
            print(f"Music Engine: Using cached file -> {filename}")

        return jsonify({
            'title': title,
            'artist': artist,
            'preview': f"/downloaded_music/{filename}", 
            'album_art': album_art,
            'duration': duration,
        })
                
    except Exception as e:
        print(f"Music Engine Fatal Error: {e}")
        return jsonify({'error': 'Service Interruption'}), 500

# --- SQLITE ENDPOINTS ---

@app.route('/history', methods=['GET'])
def get_history():
    """Fetch history for the calendar view."""
    try:
        limit = request.args.get('limit', 50, type=int)
        with get_db() as conn:
            rows = conn.execute('SELECT * FROM history ORDER BY timestamp DESC LIMIT ?', (limit,)).fetchall()
            history = [dict(row) for row in rows]
            return jsonify(history)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/history', methods=['DELETE'])
def clear_history():
    """Clear history log."""
    try:
        with get_db() as conn:
            conn.execute('DELETE FROM history')
            conn.commit()
        return jsonify({'status': 'cleared'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/mappings', methods=['GET'])
def get_mappings():
    """Get user-defined music mappings."""
    try:
        with get_db() as conn:
            rows = conn.execute('SELECT emotion, music_path FROM music_mappings').fetchall()
            return jsonify({row['emotion']: row['music_path'] for row in rows})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/mappings', methods=['POST'])
def save_mapping():
    """Save or update a music mapping."""
    try:
        data = request.json
        emotion = data.get('emotion')
        music_path = data.get('music_path')
        if not emotion or not music_path:
             return jsonify({'error': 'Missing data'}), 400
             
        with get_db() as conn:
            conn.execute('INSERT OR REPLACE INTO music_mappings (emotion, music_path) VALUES (?, ?)', (emotion, music_path))
            conn.commit()
        return jsonify({'status': 'saved'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/analyze_history', methods=['POST'])
def analyze_history():
    """Generate a simple-English stress trend report from historical readings."""
    try:
        data = request.json
        history = data.get('history', [])
        
        if not history:
             return jsonify({'analysis': 'Not enough data to generate a trend analysis.'})
             
        # Format history for prompt
        history_summary = "\\n".join([
            f"- {row.get('timestamp')}: Emotion: {row.get('fused_emotion')}, Stability: {row.get('stability', 0):.2f}, AI Note: {row.get('reasoning')}"
            for row in history
        ])

        prompt = f"""
        You are a workplace well-being assistant.
        Review the following chronological emotional history of a laptop-based employee:
        {history_summary}
        
        Write a clear 3-paragraph summary in simple English.
        Focus on stress patterns across the selected time period.
        Explain whether the person looks steady, under pressure, or improving.
        Mention important emotional shifts during the day, week, or month.
        Give exactly 2 practical tips that fit a working employee who spends long hours in front of a laptop.
        Avoid technical jargon, avoid clinical language, and do not use markdown.
        Start immediately.
        """
        
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.5,
            "max_tokens": 512
        }
        
        response = requests.post(GROQ_URL, headers=headers, json=payload, timeout=20)
        if response.status_code == 200:
            analysis = response.json()['choices'][0]['message']['content'].strip()
            return jsonify({'analysis': analysis})
        else:
            return jsonify({'analysis': 'AI Provider Error: ' + response.text}), 500
            
    except Exception as e:
        print(f"Analyze history error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/stream_local', methods=['GET'])
def stream_local():
    """Stream an absolute local file path for Emotion intervention playback."""
    file_path = request.args.get('path')
    if not file_path or not os.path.exists(file_path):
        return jsonify({'error': 'File not found'}), 404
    return send_file(file_path)

@app.route('/chat', methods=['POST'])
def chat():
    """Personalized assistant for current and time-based stress analysis."""
    try:
        data = request.get_json()
        user_message = data.get('message', '')
        results_context = data.get('context', {})
        history = data.get('history', [])[-80:]
        analysis_history = data.get('analysis_history', [])[:500]

        # Build context summary from results
        ctx_parts = []
        if results_context:
            ctx_parts.append(f"Primary Emotion: {results_context.get('fused_emotion', 'N/A')}")
            ctx_parts.append(f"Audio Emotion: {results_context.get('audio_emotion', 'N/A')}")
            ctx_parts.append(f"Video Emotion: {results_context.get('video_emotion', 'N/A')}")
            ctx_parts.append(f"Confidence: {results_context.get('timeline_confidence', 'N/A')}")
            ctx_parts.append(f"Stability: {results_context.get('emotional_stability', 'N/A')}")
            ctx_parts.append(f"Estimated Stress Level: {results_context.get('stress_label', 'N/A')}")
            ctx_parts.append(f"Estimated Stress Score: {results_context.get('stress_score', 'N/A')}")
            ctx_parts.append(f"Reasoning: {results_context.get('reasoning', 'N/A')}")
            if results_context.get('audio_temporal'):
                ctx_parts.append(f"Audio Timeline: {', '.join(results_context['audio_temporal'])}")
            if results_context.get('video_temporal'):
                ctx_parts.append(f"Video Timeline: {', '.join(results_context['video_temporal'])}")
            if results_context.get('emotion_distribution'):
                ctx_parts.append(f"Distribution: {json.dumps(results_context['emotion_distribution'])}")

        if analysis_history:
            sorted_history = sorted(analysis_history, key=lambda row: row.get('timestamp', ''))
            emotions = [row.get('fused_emotion', 'unknown') for row in sorted_history]
            stress_levels = [row.get('stress_label', 'unknown') for row in sorted_history]
            high_stress_count = sum(1 for s in stress_levels if s == 'high')
            moderate_stress_count = sum(1 for s in stress_levels if s == 'moderate')
            low_stress_count = sum(1 for s in stress_levels if s == 'low')

            from collections import Counter
            dominant_emotion = Counter(emotions).most_common(1)[0][0] if emotions else 'unknown'
            shifts = sum(1 for i in range(1, len(emotions)) if emotions[i] != emotions[i-1])

            ctx_parts.append(
                "All Runs Summary: "
                f"sessions={len(sorted_history)}, "
                f"dominant_emotion={dominant_emotion}, "
                f"high_stress={high_stress_count}, "
                f"moderate_stress={moderate_stress_count}, "
                f"low_stress={low_stress_count}, "
                f"major_emotion_shifts={shifts}."
            )

            history_lines = []
            for row in sorted_history[-120:]:
                history_lines.append(
                    f"{row.get('timestamp', 'Unknown time')}: "
                    f"emotion={row.get('fused_emotion', 'unknown')}, "
                    f"stress={row.get('stress_label', 'unknown')}, "
                    f"stability={row.get('stability', row.get('emotional_stability', 'n/a'))}, "
                    f"reasoning={row.get('reasoning', '')}"
                )
            ctx_parts.append("Recent Time-Based Pattern:\n" + "\n".join(history_lines))

        context_str = '\n'.join(ctx_parts) if ctx_parts else 'No analysis results available yet.'

        # Build messages for Groq
        messages = [
            {"role": "system", "content": f"""You are a warm, personalized workplace well-being assistant.
The user mainly wants help understanding stress levels using emotion patterns over time.
Here is the latest analysis context and recent history:

{context_str}

How to behave:
- Use SIMPLE ENGLISH.
- Answer like a supportive personal AI for a working employee who spends long hours in front of a laptop.
- Base your reply on the user's latest emotional analysis and recent time-based pattern.
- Do NOT sound clinical, robotic, or overly dramatic.
- Keep responses warm and practical. For normal questions use 2 to 4 sentences. For trend questions or when the user asks for detail, give 1 short paragraph plus action points.
- If the user asks about trends, mention day/week/month patterns when present in the context.
- Give small actions the user can do during work: breathe, stretch, hydrate, walk, pause, reduce tabs, take one task at a time.
- If asked directly about stress, explain it gently using the estimated stress level and emotional changes over time.
- If there is not enough data yet, say that kindly and ask them to run more sessions over time."""}
        ]

        # Add conversation history
        for msg in history:
            messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})

        messages.append({"role": "user", "content": user_message})

        headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 400
        }
        response = requests.post(GROQ_URL, headers=headers, json=payload)
        if response.status_code == 200:
            content = response.json()['choices'][0]['message']['content']
            return jsonify({'reply': content.strip()})
        else:
            return jsonify({'reply': 'Sorry, I couldn\'t process that right now. Please try again.'})

    except Exception as e:
        print(f"Chat error: {e}")
        return jsonify({'reply': 'Something went wrong. Please try again.'})

if __name__ == '__main__':
    app.run(debug=False, use_reloader=False, host='127.0.0.1', port=5000)
