# Trackpad Characters

A CLI application to draw mathematical symbols on your laptop trackpad and identify them using machine learning.

## Prerequisites
- Python 3.11+
- `uv` package manager
- Docker (for PostgreSQL)

## Setup

1. **Install Dependencies**:
   ```bash
   uv sync
   ```

2. **Start Database**:
   ```bash
   docker compose up -d
   ```

## Usage

The application is run via `uv run trackpad-chars` or just `trackpad-chars` if the venv is activated.

### 1. Initialize Database
Create the necessary tables.
```bash
uv run trackpad-chars init
```

### 2. Collect Training Data
Record drawings for a specific symbol.
```bash
uv run trackpad-chars collect [SYMBOL_NAME] --count [N]
```
Example:
```bash
uv run trackpad-chars collect integral --count 10
```

### 3. Train Model
Train the classifier on the collected data.
```bash
uv run trackpad-chars train
```

### 4. Live Prediction
Draw strokes and get real-time predictions.
```bash
uv run trackpad-chars predict
```

### 5. Statistics
See how many drawings you have collected.
```bash
uv run trackpad-chars stats
```

## Architecture
- **Data Storage**: PostgreSQL (Dockerized)
- **Input**: `pynput` (Mouse/Trackpad)
- **ML**: `scikit-learn` (KNN)
- **CLI**: `typer`
