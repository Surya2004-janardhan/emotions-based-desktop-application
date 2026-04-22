FROM python:3.10.14-slim-bookworm

# System deps — OpenCV needs libGL, ffmpeg for audio extraction
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Upgrade pip first (avoids resolver bugs with heavy deps)
RUN pip install --no-cache-dir --upgrade pip

# Install Python deps first (docker layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# HF Spaces requires port 7860
EXPOSE 7860

CMD ["python", "app.py"]
