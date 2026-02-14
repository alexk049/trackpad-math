# Trackpad Math

> **Turn your trackpad into a mathematical input device using machine learning.**

<p align="center">
  <img src="frontend/public/app-logo-no-bg.png" alt="Trackpad Math Logo" width="180" />
</p>

<p align="center">
  <img src="https://img.shields.io/github/v/release/alexk049/trackpad-math?style=for-the-badge&logo=github" alt="GitHub Release"/>
  <img src="https://img.shields.io/badge/Python-3.11+-blue.svg?style=for-the-badge&logo=python&logoColor=white" alt="Python"/>
  <img src="https://img.shields.io/badge/React-2024-61DAFB.svg?style=for-the-badge&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/Tauri-v2-FFC131.svg?style=for-the-badge&logo=tauri&logoColor=black" alt="Tauri"/>
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License"/>
</p>

Trackpad Math is a desktop application that transforms your laptop trackpad into a handwriting interface for mathematics. By leveraging an on-device machine learning model (KNN), the app recognizes hand-drawn symbols in real-time and instantly converts them into LaTeX code—eliminating the need for an external drawing tablet.

---

## ✨ Key Features
- **Real-Time Stroke Recognition**: Powered by an optimized on-device KNN classifier, the app translates hand-drawn gestures into mathematical symbols with minimal latency.
- **Seamless LaTeX Integration**: Instantly generate clean LaTeX strings for complex operators, Greek letters, and standard notation, ready to be pasted into your editor of choice.
- **Cross Platform**: Available for Windows/MacOS/Linux. Designed specifically for standard laptop trackpads, no external drawing tablets or styluses required.
- **Privacy-First & Offline**: All machine learning inference happens locally on your machine, ensuring your data never leaves your device and the app remains functional without an internet connection.
- **Intuitive Controls**: Scroll left/right/up/down to move your cursor through the equation and make edits.
- **Custom Training**: Teach the model your own handwriting style. For ease of use, model is pretrained with some basic math symbols.


## 🎬 Demo

https://github.com/user-attachments/assets/af6bae47-f41c-4465-a715-1eca91c62ea9

## 🚀 Quick Start (Development)

To run the application in development mode, you will need to start both the Python backend and the Tauri frontend in separate terminals.

### Prerequisites

| Tool | Recommended Version |
| :--- | :--- |
| **Node.js** | 18+ |
| **Rust** | 1.76+ ([rustup.rs](https://rustup.rs/)) |
| **Python** | 3.11+ |
| **uv** | Latest ([astral.sh/uv](https://astral.sh/uv)) |

#### Linux System Dependencies
If you are on Linux, you'll need the following libraries for Tauri and the trackpad listener:
```bash
sudo apt-get install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libglib2.0-dev
```

### Setup Steps

1. **Run Backend**:
   ```bash
   uv sync
   uv run python src/run_backend.py --dev
   ```

2. **Initialize Sidecar Dummy**:
   Tauri requires the sidecar binary to exist at compile-time, even in dev mode. Create a dummy file for your platform:

   **Linux (x64)**:
   ```bash
   mkdir -p frontend/src-tauri/binaries
   touch frontend/src-tauri/binaries/trackpad-math-backend-x86_64-unknown-linux-gnu
   chmod +x frontend/src-tauri/binaries/trackpad-math-backend-x86_64-unknown-linux-gnu
   ```

   **Windows (x64)**:
   ```powershell
   mkdir -p frontend/src-tauri/binaries
   echo $null >> frontend/src-tauri/binaries/trackpad-math-backend-x86_64-pc-windows-msvc.exe
   ```

   **macOS (Silicon/aarch64)**:
   ```bash
   mkdir -p frontend/src-tauri/binaries
   touch frontend/src-tauri/binaries/trackpad-math-backend-aarch64-apple-darwin
   chmod +x frontend/src-tauri/binaries/trackpad-math-backend-aarch64-apple-darwin
   ```

   **macOS (Intel/x86_64)**:
   ```bash
   mkdir -p frontend/src-tauri/binaries
   touch frontend/src-tauri/binaries/trackpad-math-backend-x86_64-apple-darwin
   chmod +x frontend/src-tauri/binaries/trackpad-math-backend-x86_64-apple-darwin
   ```

3. **Setup Frontend**:
   In a new terminal:
   ```bash
   cd frontend
   npm install
   npm run tauri dev
   ```

**Note**: 
   If you want to run the sidecar in development, compile the python backend and move it to the correct location as shown in the "Buiding for Distribution" section. Then run the following commands:
   ```bash
   cd frontend
   npm run tauri:release
   ```

## 📦 Building for Distribution

Bundling the application for production requires a multi-step process to package the Python backend as a "sidecar" binary.

### 1. Compile Python Backend
Generate the standalone executable using PyInstaller:
```bash
uv run pyinstaller build_backend.spec --noconfirm
```

### 2. Configure Sidecar Binary
Tauri expects the backend to be in a specific folder with a platform-specific suffix. Copy the binary from `dist/` to `frontend/src-tauri/binaries/`:

| Platform | Target File Name |
| :--- | :--- |
| **Linux (x64)** | `trackpad-math-backend-x86_64-unknown-linux-gnu` |
| **Windows (x64)** | `trackpad-math-backend-x86_64-pc-windows-msvc.exe` |
| **macOS (Silicon)** | `trackpad-math-backend-aarch64-apple-darwin` |
| **macOS (Intel)** | `trackpad-math-backend-x86_64-apple-darwin` |

### 3. Build the Installer
Finally, bundle everything into a native installer:
```bash
cd frontend
npm run tauri build
```
The final installers will be generated in `frontend/src-tauri/target/release/bundle`.


## 🛠️ Architecture

The application follows a **Sidecar Architecture**:

- **Frontend**: Built with **React** and **Mantine UI**, communicating via WebSockets for real-time updates.
- **Bridge**: **Tauri (Rust)** manages the OS-level window and lifecycle of the Python backend.
- **Backend API**: **FastAPI** handles the heavy lifting, including hardware input capturing via `pynput` and ML processing.
- **Intelligence**: A custom implementation using **Scikit-learn (KNN)** for robust gesture recognition.
- **Storage**: **SQLite** (via SQLAlchemy) persists training data and application settings.


## 📂 Project Structure

```text
├── frontend/                # React (Vite) + Tauri source
│   ├── src/                 # UI components and pages
│   └── src-tauri/           # Rust-based desktop bridge & config
└── src/                     # Python Backend source
```

## 🤝 Contributing

All contributions are welcome!

## 📄 License

This project is licensed under the **MIT License**.
