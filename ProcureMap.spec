# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path


ROOT = Path.cwd()

a = Analysis(
    ["procuremap_app.py"],
    pathex=[str(ROOT)],
    binaries=[],
    datas=[
        ("参考.html", "."),
        ("scripts", "scripts"),
    ],
    hiddenimports=[
        "procuremap_cli",
        "scripts.generate_wuhu_aluminum_report",
        "scripts.render_reference_style_wuhu_aluminum",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="ProcureMap",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
