from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import librosa
from tensorflow import keras
import requests
import ffmpeg
import os
import json

app = Flask(__name__)
CORS(app)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB limit for uploads
# Emotion labels (must match training order)
EMOTIONS_7 = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgust', 'surprised']

# Load models once at startup
print("Loading models...")
try:
    audio_model = keras.models.load_model('models/audio_emotion_model.h5')
    video_model = keras.models.load_model('models/video_emotion_model.h5')
    base_model = keras.applications.MobileNetV2(weights='imagenet', include_top=False, input_shape=(112, 112, 3))
    base_model.trainable = False
    print("Models loaded successfully")
except Exception as e:
    print(f"Error loading models: {e}")
    audio_model = None
    video_model = None
    base_model = None

# Initialize Groq client
# below trying to set env of groq
# GROQ_API_KEY 
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
print("Groq client initialized", os.getenv("GROQ_API_KEY"))
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

def cognitive_reasoning(audio_emotion, video_emotion, fused_emotion, audio_preds, video_preds):
    """Enhanced cognitive reasoning with more detailed analysis."""
    reasoning = []

    # Basic agreement analysis
    if audio_emotion == video_emotion:
        reasoning.append(f"Both audio and video modalities strongly agree on {audio_emotion}.")
    else:
        reasoning.append(f"Modalities show disagreement: audio suggests {audio_emotion} while video indicates {video_emotion}. Fusion resulted in {fused_emotion} as the most balanced interpretation.")

    # Confidence analysis with scores
    audio_conf = np.max(np.mean(audio_preds, axis=0))
    video_conf = np.max(np.mean(video_preds, axis=0))
    reasoning.append(f"Confidence levels: Audio {audio_conf:.2f}, Video {video_conf:.2f}. Higher confidence indicates more reliable detection.")

    # Temporal consistency analysis
    audio_consistency = len(set([EMOTIONS_7[np.argmax(p)] for p in audio_preds])) / len(audio_preds)
    video_consistency = len(set([EMOTIONS_7[np.argmax(p)] for p in video_preds])) / len(video_preds)
    reasoning.append(f"Temporal stability: Audio consistency {audio_consistency:.2f}, Video consistency {video_consistency:.2f}. Lower values indicate more emotional fluctuation.")

    # Emotion intensity analysis
    audio_intensity = np.mean([np.max(p) for p in audio_preds])
    video_intensity = np.mean([np.max(p) for p in video_preds])
    reasoning.append(f"Emotional intensity: Audio {audio_intensity:.2f}, Video {video_intensity:.2f}. Higher values suggest stronger emotional expression.")

    # Contextual interpretation
    if fused_emotion in ['angry', 'fearful', 'sad']:
        reasoning.append("Detected negative emotion cluster. This may indicate stress, concern, or dissatisfaction. Consider environmental factors and personal context.")
    elif fused_emotion in ['happy', 'surprised']:
        reasoning.append("Positive emotional state detected. This suggests engagement, satisfaction, or pleasant surprise. The person appears to be in a favorable emotional state.")
    elif fused_emotion == 'neutral':
        reasoning.append("Neutral emotional state observed. This could indicate calmness, concentration, or emotional restraint. May also suggest controlled or professional demeanor.")
    elif fused_emotion == 'disgust':
        reasoning.append("Disgust detected. This emotion often relates to aversion or strong disapproval. Consider recent experiences or environmental factors.")

    # Modality reliability assessment
    if abs(audio_conf - video_conf) > 0.3:
        if audio_conf > video_conf:
            reasoning.append("Audio modality appears more reliable. This could be due to clear vocal expression or poor video quality.")
        else:
            reasoning.append("Video modality appears more reliable. This might indicate clear facial expressions or audio recording issues.")
    else:
        reasoning.append("Both modalities show balanced reliability, suggesting consistent emotional expression across channels.")

    # Temporal pattern analysis
    audio_changes = sum(1 for i in range(1, len(audio_preds)) if np.argmax(audio_preds[i]) != np.argmax(audio_preds[i-1]))
    video_changes = sum(1 for i in range(1, len(video_preds)) if np.argmax(video_preds[i]) != np.argmax(video_preds[i-1]))
    reasoning.append(f"Emotional transitions: Audio {audio_changes}, Video {video_changes}. Frequent changes may indicate emotional volatility or complex feelings.")

    return " ".join(reasoning)

def generate_llm_content(fused_emotion, reasoning, audio_temporal, video_temporal):
    """Generate personalized story, quote, video, books, and songs using Groq LLM."""
    prompt = f"""
Based on the emotion analysis results:

Primary Emotion Detected: {fused_emotion}
Cognitive Analysis: {reasoning}
Audio Emotional Timeline: {', '.join(audio_temporal)}
Video Emotional Timeline: {', '.join(video_temporal)}

Please generate highly personalized content that directly relates to this specific emotional state and analysis:

1. A personalized story (approximately 200 words) that captures the emotional journey shown in the timeline and explains the fusion result. Make it detailed and narrative-rich.

2. An inspirational quote specifically tailored to someone experiencing this emotion.

3. A YouTube video recommendation as an object with keys: title, channel, link (a real YouTube URL), and reason (why it helps).

4. 2-3 short book recommendations as an array of objects with keys: title, author, and reason (why it suits this emotional state). Pick well-known, accessible books.

5. 3-4 song recommendations with specific artist names, song titles, streaming links, and brief explanations.

Format the response as valid JSON with keys: story, quote, video (object with title/channel/link/reason), books (array of objects with title/author/reason), songs (array of objects with artist/title/link/explanation).
Ensure the content is empathetic, supportive, and directly addresses the detected emotional state and cognitive insights.
"""
    try:
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        data = {
            "model": "llama-3.3-70b-versatile",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.8,
            "max_tokens": 1000
        }
        response = requests.post(GROQ_URL, headers=headers, json=data)
        if response.status_code == 200:
            try:
                raw_json = response.json()
                content = raw_json['choices'][0]['message']['content']
                # Clean up JSON response
                content = content.strip()
                if content.startswith('```json'):
                    content = content[7:]
                if content.endswith('```'):
                    content = content[:-3]
                content = content.strip()
                try:
                    return json.loads(content)
                except Exception as json_err:
                    print(f"LLM JSON parse error: {json_err}\nRaw content: {content}")
                    return generate_fallback_content(fused_emotion)
            except Exception as api_json_err:
                print(f"LLM API response JSON error: {api_json_err}\nRaw response: {response.text}")
                return generate_fallback_content(fused_emotion)
        else:
            print(f"Groq API error: {response.status_code} - {response.text}")
            return generate_fallback_content(fused_emotion)
    except Exception as e:
        print(f"LLM error: {e}")
        return generate_fallback_content(fused_emotion)

def generate_fallback_content(fused_emotion):
    """Generate sophisticated fallback content when LLM fails."""
    fallbacks = {
        'happy': {
            'story': 'A luminous joy radiated through the atmosphere as the soul expressed pure exuberance. The temporal patterns reveal a steady ascent into a state of genuine contentment and radiant positivity.',
            'quote': '"To be happy is to be able to become aware of oneself without fright." — Walter Benjamin',
            'video': {'title': 'The Science of Happiness', 'channel': 'PsycSpace', 'link': 'https://www.youtube.com/watch?v=k0GQSJrpVhM', 'reason': 'A deep dive into the neurological foundations of joy.'},
            'books': [{'title': 'The Happiness Project', 'author': 'Gretchen Rubin', 'reason': 'Practical strategies for cultivating daily joy.'}, {'title': 'Flow', 'author': 'Mihaly Csikszentmihalyi', 'reason': 'Understanding the psychology of optimal experience.'}],
            'songs': [{'artist': 'Pharrell Williams', 'title': 'Happy', 'link': 'https://open.spotify.com/track/60nZcImuRpwqvhoqzY6DkC', 'explanation': 'An anthem of pure, unadulterated joy.'}, {'artist': 'Coldplay', 'title': 'A Sky Full of Stars', 'link': 'https://open.spotify.com/track/0FDm920U779LdvC0p2H4v0', 'explanation': 'A vibrant sonic landscape matching elevated emotional states.'}]
        },
        'sad': {
            'story': 'A quiet melancholy permeated the recording, characterized by introspective pauses and a tender vulnerability. The emotional arc suggests a profound depth of feeling and reflective sorrow.',
            'quote': '"There is no greater sorrow than to recall in misery the time when we were happy." — Dante Alighieri',
            'video': {'title': 'The Art of Sadness', 'channel': 'The School of Life', 'link': 'https://www.youtube.com/watch?v=vV_5X_8oPBM', 'reason': 'Exploring the beauty and necessity of our darker moods.'},
            'books': [{'title': 'When Things Fall Apart', 'author': 'Pema Chödrön', 'reason': 'Finding peace in impermanence and difficulty.'}, {'title': 'Man\'s Search for Meaning', 'author': 'Viktor Frankl', 'reason': 'Discovering purpose through suffering.'}],
            'songs': [{'artist': 'Adele', 'title': 'Someone Like You', 'link': 'https://open.spotify.com/track/15077jNn9m5b5l9a', 'explanation': 'A masterful expression of longing and emotional processing.'}, {'artist': 'Bon Iver', 'title': 'Holocene', 'link': 'https://open.spotify.com/track/4fbvS168v79H9u6S', 'explanation': 'Reflective and atmospheric for moments of deep contemplation.'}]
        },
        'angry': {
            'story': 'A surge of intense energy was detected, manifesting in sharp vocal modulations and forceful expressions. This visceral reaction reflects a powerful stand against perceived injustice or frustration.',
            'quote': '"For every minute you are angry you lose sixty seconds of happiness." — Ralph Waldo Emerson',
            'video': {'title': 'Managing the Fire Within', 'channel': 'TED', 'link': 'https://www.youtube.com/watch?v=S0uA56nE8p0', 'reason': 'Channeling anger into constructive action.'},
            'books': [{'title': 'Anger', 'author': 'Thich Nhat Hanh', 'reason': 'Mindful approaches to transforming anger.'}, {'title': 'The Dance of Anger', 'author': 'Harriet Lerner', 'reason': 'Positive patterns for expressing anger constructively.'}],
            'songs': [{'artist': 'Linkin Park', 'title': 'In the End', 'link': 'https://open.spotify.com/track/60077jNn9m5b5l9a', 'explanation': 'A rhythmic outlet for complex frustrations.'}, {'artist': 'Rage Against the Machine', 'title': 'Killing in the Name', 'link': 'https://open.spotify.com/track/59077jNn9m5b5l9a', 'explanation': 'Raw energy to match internal intensity.'}]
        },
        'fearful': {
            'story': 'A sense of cautious trepidation was observed, with signals suggesting high vigilance and internal tension. The timeline indicates a journey through uncertainty toward a search for security.',
            'quote': '"The only thing we have to fear is fear itself." — Franklin D. Roosevelt',
            'video': {'title': 'Overcoming the Unknown', 'channel': 'Breathwork', 'link': 'https://www.youtube.com/watch?v=yW6zK-N-x9U', 'reason': 'Techniques for grounding in moments of fear.'},
            'books': [{'title': 'Feel the Fear and Do It Anyway', 'author': 'Susan Jeffers', 'reason': 'Practical guide to moving through fear.'}, {'title': 'The Gift of Fear', 'author': 'Gavin de Becker', 'reason': 'Understanding how fear protects us.'}],
            'songs': [{'artist': 'Taylor Swift', 'title': 'Fearless', 'link': 'https://open.spotify.com/track/12077jNn9m5b5l9a', 'explanation': 'A reminder of courage within every heartbeat.'}, {'artist': 'Florence + The Machine', 'title': 'Shake It Out', 'link': 'https://open.spotify.com/track/30077jNn9m5b5l9a', 'explanation': 'A rhythmic exorcism of lingering anxieties.'}]
        },
        'neutral': {
            'story': 'A state of exquisite equilibrium and stoic poise was maintained throughout the session. The stability of the signals reflects a centered consciousness and professional restraint.',
            'quote': '"Nothing diminishes anxiety faster than action." — Walter Richard Sickert',
            'video': {'title': 'The Power of Stillness', 'channel': 'Mindfulness', 'link': 'https://www.youtube.com/watch?v=m8rRzTtP7Tc', 'reason': 'The benefits of emotional neutrality.'},
            'books': [{'title': 'The Power of Now', 'author': 'Eckhart Tolle', 'reason': 'Embracing present-moment awareness.'}, {'title': 'Stillness Is the Key', 'author': 'Ryan Holiday', 'reason': 'Finding calm in a chaotic world.'}],
            'songs': [{'artist': 'Ludovico Einaudi', 'title': 'Nuvole Bianche', 'link': 'https://open.spotify.com/track/33077jNn9m5b5l9a', 'explanation': 'Pianistic perfection for centered focus.'}, {'artist': 'Air', 'title': 'Alone in Kyoto', 'link': 'https://open.spotify.com/track/44077jNn9m5b5l9a', 'explanation': 'Minimalist atmosphere for calm contemplation.'}]
        },
        'surprised': {
            'story': 'A sudden rupture in the expected emotional flow led to a state of dynamic astonishment. The high-intensity peaks indicate a genuine reaction to the unexpected and the marvelous.',
            'quote': '"The world is full of magic things, patiently waiting for our senses to grow sharper." — W.B. Yeats',
            'video': {'title': 'The Architecture of Awe', 'channel': 'Psychology Today', 'link': 'https://www.youtube.com/watch?v=8Lz_qPv_898', 'reason': 'Understanding the psychology of surprise.'},
            'books': [{'title': 'Stumbling on Happiness', 'author': 'Daniel Gilbert', 'reason': 'How our minds trick us about what makes us happy.'}, {'title': 'The Unexpected', 'author': 'Maria Konnikova', 'reason': 'The science of surprises and wonder.'}],
            'songs': [{'artist': 'Post Malone', 'title': 'Wow.', 'link': 'https://open.spotify.com/track/55077jNn9m5b5l9a', 'explanation': 'A celebration of the unexpected.'}, {'artist': 'Electric Light Orchestra', 'title': 'Mr. Blue Sky', 'link': 'https://open.spotify.com/track/66077jNn9m5b5l9a', 'explanation': 'A burst of sonic light and wonder.'}]
        },
        'disgust': {
            'story': 'A visceral sense of aversion was detected, manifesting as a sharp withdrawal from the stimulus. The analysis suggests a strong internal boundary being established.',
            'quote': '"Disgust is the visceral realization that we have a standard." — Anonymous',
            'video': {'title': 'The Evolution of Aversion', 'channel': 'Psych2Go', 'link': 'https://www.youtube.com/watch?v=O1_qPV7X9Yw', 'reason': 'Why we feel disgust and how to transcend it.'},
            'books': [{'title': 'Radical Acceptance', 'author': 'Tara Brach', 'reason': 'Embracing life with compassion.'}, {'title': 'The Upside of Your Dark Side', 'author': 'Todd Kashdan', 'reason': 'Finding value in uncomfortable emotions.'}],
            'songs': [{'artist': 'Britney Spears', 'title': 'Toxic', 'link': 'https://open.spotify.com/track/77077jNn9m5b5l9a', 'explanation': 'Recognizing what we find disagreeable.'}, {'artist': 'Lorde', 'title': 'Pure Heroine', 'link': 'https://open.spotify.com/track/88077jNn9m5b5l9a', 'explanation': 'Subtle disdain for the mundane.'}]
        }
    }

    return fallbacks.get(fused_emotion, fallbacks['neutral'])

def sample_frames(video_path):
    """Sample frame sequences from video over time."""
    cap = cv2.VideoCapture(video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    duration = total_frames / fps if fps > 0 else 0
    
    if total_frames == 0 or duration == 0:
        cap.release()
        return None

    # Sample sequences every VIDEO_WINDOW_SIZE seconds
    sequences = []
    window_frames = int(VIDEO_WINDOW_SIZE * fps)
    hop_frames = int(VIDEO_WINDOW_SIZE * fps / 2)  # overlap
    
    for start_frame in range(0, total_frames - window_frames + 1, hop_frames):
        end_frame = start_frame + window_frames
        frames = []
        
        for frame_idx in range(start_frame, end_frame, max(1, window_frames // NUM_FRAMES)):
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

# Global progress state
progress_state = {"progress": 0, "status": "Ready", "results": None}

@app.route('/status', methods=['GET'])
def get_status():
    return jsonify(progress_state)

@app.route('/process', methods=['POST'])
def process():
    global progress_state
    progress_state = {"progress": 0, "status": "Initializing", "results": None}
    
    print("=" * 50)
    print("STARTING EMOTION ANALYSIS PROCESS")
    print("=" * 50)

    if video_model is None or base_model is None:
        print("ERROR: Models not loaded")
        return jsonify({'error': 'Models not loaded'})

    try:
        # Save uploaded video file
        video_file = request.files['video']
        video_path = 'temp_video.webm'
        audio_path = 'temp_audio.wav'
        print(f"Saving video file to {video_path}")
        video_file.save(video_path)

        # Extract audio from video using ffmpeg-python
        progress_state["status"] = "Extracting Audio"
        progress_state["progress"] = 10
        print("Extracting audio from video...")
        try:
            stream = ffmpeg.input(video_path)
            stream = ffmpeg.output(stream, audio_path, acodec='pcm_s16le', ac=1, ar='16000')
            ffmpeg.run(stream, quiet=True, overwrite_output=True)
            print("Audio extracted successfully")
        except Exception as e:
            print(f"Audio extraction failed: {e}")
            audio_path = None

        # Process video and get temporal predictions
        progress_state["status"] = "Processing Video"
        print("Extracting video features...")
        frame_sequences = sample_frames(video_path)
        if frame_sequences is None or len(frame_sequences) == 0:
            print("ERROR: Could not extract frames from video")
            if os.path.exists(video_path):
                os.remove(video_path)
            if audio_path and os.path.exists(audio_path):
                os.remove(audio_path)
            return jsonify({'error': 'Could not extract frames from video'})

        print(f"Frame sequences shape: {frame_sequences.shape}")

        # Get video temporal predictions
        video_preds = []
        total_seq = len(frame_sequences)
        for i, seq in enumerate(frame_sequences):
            frame_features = []
            for frame in seq:
                frame_exp = np.expand_dims(frame, axis=0)
                feat = base_model(frame_exp)
                feat = keras.layers.GlobalAveragePooling2D()(feat)
                frame_features.append(feat.numpy().flatten())
            video_feat = np.mean(frame_features, axis=0)
            pred = video_model.predict(np.expand_dims(video_feat, axis=0), verbose=0)[0]
            video_preds.append(pred)
            
            # Map video processing to 10% -> 40%
            current_progress = 10 + int((i / total_seq) * 30)
            progress_state["progress"] = current_progress
            
            if i % 5 == 0:
                print(f"Processed video frame sequence {i+1}/{total_seq}")

        progress_state["progress"] = 40
        video_preds = np.array(video_preds)
        video_emotions_temporal = [EMOTIONS_7[np.argmax(pred)] for pred in video_preds]

        # Process audio if available
        audio_preds = []
        audio_emotions_temporal = []
        if audio_path and os.path.exists(audio_path) and audio_model is not None:
            progress_state["status"] = "Processing Audio"
            print("Processing audio features...")
            try:
                mfcc_windows = extract_mfcc(audio_path)
                if mfcc_windows is not None and len(mfcc_windows) > 0:
                    total_win = len(mfcc_windows)
                    for i, mfcc_window in enumerate(mfcc_windows):
                        pred = audio_model.predict(np.expand_dims(mfcc_window, axis=0), verbose=0)[0]
                        audio_preds.append(pred)
                        
                        # Map audio processing to 40% -> 80%
                        current_progress = 40 + int((i / total_win) * 40)
                        progress_state["progress"] = current_progress
                        
                        if i % 10 == 0:
                            print(f"Processed audio window {i+1}/{total_win}")

                    audio_preds = np.array(audio_preds)
                    audio_emotions_temporal = [EMOTIONS_7[np.argmax(pred)] for pred in audio_preds]
                else:
                    print("No audio features extracted")
            except Exception as e:
                print(f"Audio processing failed: {e}")

        progress_state["progress"] = 80
        progress_state["status"] = "Cognitive Analysis"

        # TIMELINE-BASED EMOTION DETERMINATION
        from collections import Counter
        combined_emotions = []
        if audio_emotions_temporal and video_emotions_temporal:
            min_length = min(len(audio_emotions_temporal), len(video_emotions_temporal))
            combined_emotions = [video_emotions_temporal[i] for i in range(min_length)]
        elif video_emotions_temporal:
            combined_emotions = video_emotions_temporal
        elif audio_emotions_temporal:
            combined_emotions = audio_emotions_temporal

        emotion_counts = Counter(combined_emotions)
        total_predictions = len(combined_emotions)
        timeline_dominant_emotion = emotion_counts.most_common(1)[0][0]
        timeline_confidence = emotion_counts.most_common(1)[0][1] / total_predictions
        unique_emotions = len(emotion_counts)
        emotional_stability = 1.0 - (unique_emotions - 1) / len(EMOTIONS_7)
        transitions = sum(1 for i in range(1, len(combined_emotions)) if combined_emotions[i] != combined_emotions[i-1])
        transition_rate = transitions / max(1, len(combined_emotions) - 1)

        # COGNITIVE LAYER ANALYSIS
        reasoning_parts = []
        if timeline_confidence > 0.7:
            reasoning_parts.append(f"Strong emotional consistency: {timeline_dominant_emotion} in {timeline_confidence*100:.1f}%")
        else:
            reasoning_parts.append(f"Mixed state: {timeline_dominant_emotion} leads at {timeline_confidence*100:.1f}%")
        
        if emotional_stability > 0.8: reasoning_parts.append("High stability.")
        elif emotional_stability > 0.6: reasoning_parts.append("Moderate stability.")
        else: reasoning_parts.append("Low stability.")

        cognitive_reasoning = " ".join(reasoning_parts)
        progress_state["progress"] = 90
        progress_state["status"] = "Generating AI Response"

        # AI LAYER
        llm_content = generate_llm_content(
            timeline_dominant_emotion,
            cognitive_reasoning,
            video_emotions_temporal,
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
            'audio_temporal': audio_emotions_temporal,
            'video_temporal': video_emotions_temporal,
            'audio_probs_temporal': audio_probs,
            'video_probs_temporal': video_probs,
            'time_points': list(range(len(combined_emotions))),
            'timeline_confidence': float(timeline_confidence),
            'emotional_stability': float(emotional_stability),
            'transition_rate': float(transition_rate),
            'emotion_distribution': dict(emotion_counts)
        }

        # Clean up
        for path in [video_path, audio_path]:
            if path and os.path.exists(path): os.remove(path)

        progress_state["progress"] = 100
        progress_state["status"] = "Complete"
        progress_state["results"] = final_result
        return jsonify(final_result)

    except Exception as e:
        progress_state["status"] = f"Error: {str(e)}"
        return jsonify({'error': str(e)})

@app.route('/chat', methods=['POST'])
def chat():
    """Chatbot endpoint — answers questions about analysis results."""
    try:
        data = request.get_json()
        user_message = data.get('message', '')
        results_context = data.get('context', {})
        history = data.get('history', [])[-10:]  # keep last 10 messages

        # Build context summary from results
        ctx_parts = []
        if results_context:
            ctx_parts.append(f"Primary Emotion: {results_context.get('fused_emotion', 'N/A')}")
            ctx_parts.append(f"Audio Emotion: {results_context.get('audio_emotion', 'N/A')}")
            ctx_parts.append(f"Video Emotion: {results_context.get('video_emotion', 'N/A')}")
            ctx_parts.append(f"Confidence: {results_context.get('timeline_confidence', 'N/A')}")
            ctx_parts.append(f"Stability: {results_context.get('emotional_stability', 'N/A')}")
            ctx_parts.append(f"Reasoning: {results_context.get('reasoning', 'N/A')}")
            if results_context.get('audio_temporal'):
                ctx_parts.append(f"Audio Timeline: {', '.join(results_context['audio_temporal'])}")
            if results_context.get('video_temporal'):
                ctx_parts.append(f"Video Timeline: {', '.join(results_context['video_temporal'])}")
            if results_context.get('emotion_distribution'):
                ctx_parts.append(f"Distribution: {json.dumps(results_context['emotion_distribution'])}")

        context_str = '\n'.join(ctx_parts) if ctx_parts else 'No analysis results available yet.'

        # Build messages for Groq
        messages = [
            {"role": "system", "content": f"""You are EmotionAI Assistant — a chatbot for the EmotionAI multimodal emotion recognition system.

User's analysis results:
{context_str}

Rules:
- For greetings (hi, hello, hey) reply with a very short friendly message only (1 line)
- For ALL other messages, ALWAYS include a brief summary of the final results: detected emotion, confidence, and key insight
- Only if the user asks a SPECIFIC question (e.g. "what was my audio emotion?"), extract that specific data from results and include it
- Keep answers SHORT and CRISP (2-3 sentences max)
- Use exactly 1 emoji per response, no more
- If no results available, tell the user to run an analysis first
- Be empathetic"""}
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
            "max_tokens": 200
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
    app.run(debug=True)
