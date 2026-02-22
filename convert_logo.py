import base64
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGE_PATH = os.path.join(BASE_DIR, 'images', 'image_5.png')
JS_PATH = os.path.join(BASE_DIR, 'logo_data.js')

with open(IMAGE_PATH, 'rb') as f:
    data = base64.b64encode(f.read()).decode()

with open(JS_PATH, 'w', encoding='utf-8') as out:
    out.write('const SIMATS_LOGO_BASE64 = "data:image/png;base64,' + data + '";\n')

print("Done. Base64 length:", len(data))
