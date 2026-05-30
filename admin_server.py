"""
HELIDA Tools 本地管理服务器
============================
双击"启动后台.bat"后，在浏览器中打开后台管理页面。
保存时会直接更新 data/content-data.js 并推送到 GitHub，
网站自动更新。
"""
import http.server
import json
import os
import sys
import subprocess
import shutil
import urllib.parse
from pathlib import Path

PORT = 8080
ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)


class AdminHandler(http.server.SimpleHTTPRequestHandler):
    """处理后台API请求 + 静态文件服务"""

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path

        # 根路径 → 管理后台
        if path == "/" or path == "":
            self.send_response(302)
            self.send_header("Location", "/admin.html")
            self.end_headers()
            return

        # 静态文件，禁用缓存
        self.send_response(200)
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")

        # 根据扩展名设置 Content-Type
        if path.endswith(".html"):
            self.send_header("Content-Type", "text/html; charset=utf-8")
        elif path.endswith(".js"):
            self.send_header("Content-Type", "application/javascript; charset=utf-8")
        elif path.endswith(".css"):
            self.send_header("Content-Type", "text/css; charset=utf-8")
        elif path.endswith(".json"):
            self.send_header("Content-Type", "application/json; charset=utf-8")
        elif path.endswith(".png"):
            self.send_header("Content-Type", "image/png")
        elif path.endswith(".jpg") or path.endswith(".jpeg"):
            self.send_header("Content-Type", "image/jpeg")
        elif path.endswith(".svg"):
            self.send_header("Content-Type", "image/svg+xml")
        elif path.endswith(".ico"):
            self.send_header("Content-Type", "image/x-icon")

        try:
            filepath = os.path.join(ROOT, path.lstrip("/"))
            if not os.path.isfile(filepath):
                self.send_error(404)
                return
            with open(filepath, "rb") as f:
                content = f.read()
            self.send_header("Content-Length", len(content))
            self.end_headers()
            self.wfile.write(content)
        except Exception:
            self.send_error(500)

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path

        if path == "/api/save":
            self.handle_save()
        elif path == "/api/upload-image":
            self.handle_upload()
        elif path == "/api/push":
            self.handle_push()
        else:
            self.send_error(404)

    def handle_save(self):
        """保存 content 数据到 data/content-data.js 并提交到 GitHub"""
        try:
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length))

            # 读取当前 content-data.js
            js_path = os.path.join(ROOT, "data", "content-data.js")
            if os.path.exists(js_path):
                with open(js_path, "r", encoding="utf-8") as f:
                    js_content = f.read()
            else:
                js_content = ""

            # 更新版本号
            if "version" not in data:
                data["version"] = 1
            else:
                data["version"] = data.get("version", 1) + 1

            # 生成新的 JS 文件
            new_js = f"// HELIDA Tools - Site Content Data\n// Auto-generated: do not edit directly\nwindow.DEFAULT_CONTENT = {json.dumps(data, ensure_ascii=False, indent=2)};\n"

            with open(js_path, "w", encoding="utf-8") as f:
                f.write(new_js)

            # 同步到 content.json（备用）
            json_path = os.path.join(ROOT, "data", "content.json")
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

            # Git 操作
            result = self.git_commit_push(data["version"])

            self.send_json_response({"ok": True, "version": data["version"], "git": result})

        except Exception as e:
            self.send_json_response({"ok": False, "error": str(e)}, 500)

    def handle_upload(self):
        """上传图片到 images/ 文件夹（base64 JSON方式）"""
        try:
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length))

            filename = data.get("filename", "image.jpg")
            filename = os.path.basename(filename)
            b64_data = data.get("data", "")

            if not b64_data:
                self.send_json_response({"ok": False, "error": "无图片数据"}, 400)
                return

            # 解码 base64（去掉可能的 data:image/...;base64, 前缀）
            if "," in b64_data:
                b64_data = b64_data.split(",", 1)[1]

            import base64
            file_data = base64.b64decode(b64_data)

            # 保存到 images/ 文件夹
            dest_dir = os.path.join(ROOT, "images")
            os.makedirs(dest_dir, exist_ok=True)
            dest_path = os.path.join(dest_dir, filename)

            # 如果文件已存在，添加序号
            if os.path.exists(dest_path):
                name, ext = os.path.splitext(filename)
                counter = 1
                while os.path.exists(os.path.join(dest_dir, f"{name}_{counter}{ext}")):
                    counter += 1
                dest_path = os.path.join(dest_dir, f"{name}_{counter}{ext}")
                filename = f"{name}_{counter}{ext}"

            with open(dest_path, "wb") as f:
                f.write(file_data)

            # 返回相对路径
            rel_path = f"images/{filename}"
            self.send_json_response({"ok": True, "path": rel_path, "filename": filename})

        except Exception as e:
            self.send_json_response({"ok": False, "error": str(e)}, 500)

    def handle_push(self):
        """手动触发 Git push"""
        try:
            result = self.git_commit_push(None)
            self.send_json_response({"ok": True, "git": result})
        except Exception as e:
            self.send_json_response({"ok": False, "error": str(e)}, 500)

    def git_commit_push(self, version):
        """提交并推送到 GitHub"""
        try:
            # git add
            subprocess.run(
                ["git", "add", "data/content-data.js", "data/content.json", "images/"],
                cwd=ROOT, capture_output=True, timeout=15
            )

            # 检查是否有更改
            status = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=ROOT, capture_output=True, text=True, timeout=10
            )
            if not status.stdout.strip():
                return "没有需要提交的更改"

            # git commit
            msg = "update: admin panel save"
            if version:
                msg += f" (v{version})"
            subprocess.run(
                ["git", "commit", "-m", msg],
                cwd=ROOT, capture_output=True, timeout=15
            )

            # git push
            push = subprocess.run(
                ["git", "push"],
                cwd=ROOT, capture_output=True, text=True, timeout=30
            )

            if push.returncode == 0:
                return "✅ 已推送到 GitHub，网站将自动更新"
            else:
                return f"⚠️ Push 可能失败: {push.stderr.strip()[:200]}"

        except subprocess.TimeoutExpired:
            return "⚠️ Git 操作超时，请检查网络"
        except FileNotFoundError:
            return "⚠️ 未找到 Git，请确认已安装"
        except Exception as e:
            return f"⚠️ {str(e)[:200]}"

    def send_json_response(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def log_message(self, format, *args):
        print(f"  [{self.address_string()}] {format % args}")


def main():
    print("=" * 56)
    print("  HELIDA Tools - 网站管理后台（本地服务器）")
    print("=" * 56)
    print(f"\n  仓库目录: {ROOT}")
    print(f"  后台地址: http://localhost:{PORT}/")
    print(f"\n  请在浏览器中打开上述地址")
    print(f"  保存时会自动提交并推送到 GitHub")
    print(f"\n  按 Ctrl+C 停止服务器\n")
    print("=" * 56)

    server = http.server.HTTPServer(("127.0.0.1", PORT), AdminHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止。")
        server.shutdown()


if __name__ == "__main__":
    main()
