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

        # 静态文件
        return http.server.SimpleHTTPRequestHandler.do_GET(self)

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
        """上传图片到 images/ 文件夹"""
        try:
            content_type = self.headers.get("Content-Type", "")
            if "multipart/form-data" not in content_type:
                self.send_json_response({"ok": False, "error": "需要 multipart/form-data"}, 400)
                return

            # 简单解析 multipart
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)

            # 提取文件名和内容
            # 找 filename="..."
            body_str = body.decode("latin-1")  # 使用 latin-1 避免解码错误
            fn_start = body_str.find('filename="')
            if fn_start == -1:
                self.send_json_response({"ok": False, "error": "未找到文件"}, 400)
                return

            fn_start += 10
            fn_end = body_str.find('"', fn_start)
            filename = body_str[fn_start:fn_end]
            filename = os.path.basename(filename)  # 安全：只取文件名

            # 找文件内容起始 (\r\n\r\n)
            content_start = body_str.find("\r\n\r\n", fn_end)
            if content_start == -1:
                self.send_json_response({"ok": False, "error": "格式错误"}, 400)
                return
            content_start += 4

            # 文件内容直到 boundary
            boundary = body_str[:body_str.find("\r\n")]
            content_end = body_str.find(boundary, content_start)
            if content_end == -1:
                content_end = len(body_str)

            file_data = body[content_start:content_end].rstrip(b"\r\n-")

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
