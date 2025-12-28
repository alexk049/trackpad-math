# Trackpad Characters

A desktop and CLI application to draw mathematical symbols on your laptop trackpad and identify them using machine learning.

---

## 🚀 Desktop Application (GUI)

The application is now bundled as a standalone desktop app using **Tauri**.

### Prerequisites
- **Node.js**: Installed.
- **Rust**: Required for building. Install via [rustup.rs](https://rustup.rs/).
- **System Dependencies (Linux)**:
  ```bash
  sudo apt-get install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libglib2.0-dev
  ```

### Quick Start (Dev Mode)
1. **Activate Python Environment**:
   ```bash
   uv sync
   source .venv/bin/activate
   ```
2. **Install Frontend Dependencies**:
   ```bash
   cd frontend
   npm install
   ```
3. **Run App**:
   ```bash
   npm run tauri dev
   ```

### Building for Distribution
Tauri bundles the application for the host operating system. You should run these commands on the machine you wish to build for.

#### 1. Bundle the Python Backend
```bash
uv run pyinstaller build_backend.spec --noconfirm
```

#### 2. Prepare the Sidecar Binary
Copy the generated binary from `dist/` to the Tauri binaries folder, appending the correct **target triple** for your platform:

- **Linux (64-bit)**:
  `cp dist/trackpad-chars-backend frontend/src-tauri/binaries/trackpad-chars-backend-x86_64-unknown-linux-gnu`
- **Windows (64-bit)**:
  `copy dist\trackpad-chars-backend.exe frontend\src-tauri\binaries\trackpad-chars-backend-x86_64-pc-windows-msvc.exe`
- **macOS (Apple Silicon)**:
  `cp dist/trackpad-chars-backend frontend/src-tauri/binaries/trackpad-chars-backend-aarch64-apple-darwin`
- **macOS (Intel)**:
  `cp dist/trackpad-chars-backend frontend/src-tauri/binaries/trackpad-chars-backend-x86_64-apple-darwin`

#### 3. Build the Installer
```bash
cd frontend
npm run tauri build
```
The installer will be located in `frontend/src-tauri/target/release/bundle`.

---

## 💻 CLI Usage

The application can also be run directly via the command line using `uv run trackpad-chars`.

### 1. Initialize Database
Create the necessary SQLite tables.
```bash
uv run trackpad-chars init
```

### 2. Collect Training Data
Record drawings for a specific symbol.
```bash
uv run trackpad-chars collect [SYMBOL_NAME] --count [N]
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

---

## 🛠️ Architecture
- **GUI**: React + Tauri
- **Backend**: FastAPI (Python) bundled as a sidecar
- **Data Storage**: SQLite (`app.db`)
- **Input**: `pynput` (Mouse/Trackpad)
- **ML**: `scikit-learn` (KNN)
- **CLI**: `typer`
