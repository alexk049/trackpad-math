# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

block_cipher = None

hidden_imports = [
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'sklearn.neighbors.typedefs',
    'sklearn.utils._typedefs',
    'sklearn.neighbors._partition_nodes',
    'scipy.special.cython_special',
    'sklearn.tree._utils', 
]

# Use collect_all to robustly gather all components of complex libraries
from PyInstaller.utils.hooks import collect_all

tmp_datas = []
tmp_binaries = []

for package in ['sklearn', 'scipy', 'fastdtw', 'pynput', 'pandas']:
    p_datas, p_binaries, p_hidden = collect_all(package)
    tmp_datas.extend(p_datas)
    tmp_binaries.extend(p_binaries)
    hidden_imports.extend(p_hidden)


a = Analysis(
    ['src/run_backend.py'],
    pathex=[],
    binaries=tmp_binaries,
    datas=[('src/trackpad_math/data/seed_drawings.json', 'trackpad_math/data')] + tmp_datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='trackpad-math-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
