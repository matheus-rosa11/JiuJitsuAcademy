FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    INSIGHTFACE_HOME=/opt/insightface \
    PORT=8080

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        g++ \
        python3-dev \
        libglib2.0-0 \
        libgomp1 \
        libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && python -c "from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_l', root='/opt/insightface').prepare(ctx_id=-1, det_size=(640, 640))"

COPY app ./app

EXPOSE 8080

CMD ["sh", "-c", "uvicorn app.main:app --host :: --port ${PORT:-8080}"]
