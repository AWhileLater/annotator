#!/usr/bin/env python
# 打包发布用 zip（Chrome Web Store 要求上传 zip，且 manifest.json 必须位于 zip 顶层）
# 用法：python pack-zip.py  ->  dist/annotator.zip
import os
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
OUT = os.path.join(ROOT, 'dist', 'annotator.zip')
SKIP_DIRS = {'.git', '__pycache__', 'node_modules'}
SKIP_FILES = {'.DS_Store'}

os.makedirs(os.path.dirname(OUT), exist_ok=True)
if os.path.exists(OUT):
    os.remove(OUT)

with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(SRC):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if f in SKIP_FILES:
                continue
            fp = os.path.join(root, f)
            arc = os.path.relpath(fp, SRC)  # 顶层为 manifest.json
            z.write(fp, arc)

print('打包完成：', OUT)
