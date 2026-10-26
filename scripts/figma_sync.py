import os
import sys
import json
import urllib.request
import re

# Tự động đọc biến môi trường từ .env
ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
env_vars = {}
if os.path.exists(ENV_PATH):
    with open(ENV_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                env_vars[k.strip()] = v.strip()

FILE_KEY = os.environ.get('FIGMA_FILE_KEY', env_vars.get('FIGMA_FILE_KEY', 'N3bLayzGCuHVVejxOEVN4D'))
TOKEN = os.environ.get('FIGMA_ACCESS_TOKEN', env_vars.get('FIGMA_ACCESS_TOKEN', ''))

def api_request(url):
    req = urllib.request.Request(url, headers={'X-Figma-Token': TOKEN})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def get_file_info(depth=2):
    url = f"https://api.figma.com/v1/files/{FILE_KEY}?depth={depth}"
    return api_request(url)

def get_nodes(node_ids):
    ids_str = ",".join(node_ids)
    url = f"https://api.figma.com/v1/files/{FILE_KEY}/nodes?ids={ids_str}"
    return api_request(url)

def get_images(node_ids, scale=2):
    ids_str = ",".join(node_ids)
    url = f"https://api.figma.com/v1/images/{FILE_KEY}?ids={ids_str}&format=png&scale={scale}"
    return api_request(url)

if __name__ == '__main__':
    try:
        data = get_file_info(depth=2)
        print(f"✅ Kết nối Figma thành công!")
        print(f"📁 Tên File: {data.get('name')}")
        print(f"🕒 Lần chỉnh sửa cuối: {data.get('lastModified')}")
        
        pages = data.get('document', {}).get('children', [])
        for page in pages:
            frames = page.get('children', [])
            if not frames:
                continue
            print(f"\n📄 {page.get('name')} ({len(frames)} màn hình / frame):")
            for f in frames:
                if f.get('type') == 'FRAME':
                    print(f"  • {f.get('name')} (ID: {f.get('id')})")
    except Exception as e:
        print(f"❌ Lỗi: {e}")
