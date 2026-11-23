# -*- coding: utf-8 -*-
"""
荔枝产销协同决策智能体平台 —— 现场演示服务器
功能：
  1. 将平台目录作为静态站点发布（手机浏览器可直接访问）
  2. 自动探测本机局域网 IP，生成最新二维码（扫码进入.png）与访问地址（扫码地址.txt）
  3. 自动打开浏览器展示“扫码演示页”
  4. 绑定 0.0.0.0，同一 WiFi 下任意手机可扫码访问
用法：python server.py   （或双击 启动演示服务器.bat）
"""
import os
import sys
import socket
import threading
import http.server
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT_START = 8080
PORT_FALLBACKS = [8000, 8899, 9090]

sys.stdout.reconfigure(encoding='utf-8')


def lan_ip():
    """探测本机局域网 IP"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(1)
        s.connect(("223.5.5.5", 80))  # 阿里DNS，仅用于取路由，不产生真实流量
        ip = s.getsockname()[0]
        s.close()
        if ip and not ip.startswith("127."):
            return ip
    except Exception:
        pass
    try:
        return socket.gethostbyname(socket.gethostname())
    except Exception:
        return "127.0.0.1"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, fmt, *args):
        # 精简日志
        print("  [访问] %s" % (self.address_string()), end="  ")
        print(fmt % args)

    def end_headers(self):
        # 缓存控制：演示数据实时变化，关闭缓存避免手机读到旧页面
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


def make_qr(url):
    """生成最新二维码 PNG 与地址文件"""
    try:
        import qrcode
        qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M,
                           box_size=12, border=3)
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#0E3D27", back_color="#FFFFFF")
        img = img.resize((640, 640))
        png = os.path.join(ROOT, "扫码进入.png")
        img.save(png)
        return png
    except Exception as e:
        print("  [警告] 二维码生成失败：%s" % e)
        return None


def start_server(port):
    try:
        httpd = http.server.ThreadingHTTPServer(("0.0.0.0", port), Handler)
        return httpd
    except OSError:
        return None


def main():
    print("=" * 56)
    print("  荔枝产销协同决策智能体平台 · 现场演示服务器")
    print("=" * 56)

    ip = lan_ip()
    httpd = None
    used_port = None
    for port in [PORT_START] + PORT_FALLBACKS:
        httpd = start_server(port)
        if httpd:
            used_port = port
            break
    if httpd is None:
        print("  [错误] 常用端口均被占用，请关闭占用程序后重试")
        input("按回车退出...")
        sys.exit(1)

    url = "http://%s:%d/" % (ip, used_port)
    qr_url = "http://%s:%d/qr.html" % (ip, used_port)

    # 生成二维码与地址文件
    png = make_qr(url)
    addr_file = os.path.join(ROOT, "扫码地址.txt")
    with open(addr_file, "w", encoding="utf-8") as f:
        f.write("荔枝产销协同平台 · 手机访问地址\n")
        f.write("平台入口:  %s\n" % url)
        f.write("扫码演示页: %s\n" % qr_url)
        f.write("互联网公开链接: https://RuMMMMMMMMM.github.io/\n")
        f.write("（局域网访问须与本机同一 WiFi；二维码见 扫码进入.png，每次启动自动更新）\n")

    print()
    print("  平台入口（手机直接打开）: %s" % url)
    print("  扫码演示页（大屏展示用）: %s" % qr_url)
    print("  互联网公开链接: https://RuMMMMMMMMM.github.io/")
    print("  二维码文件: %s" % ("扫码进入.png" if png else "生成失败"))
    print("  地址文件: %s" % "扫码地址.txt")
    print()
    print("  提示：手机与本机必须连接同一 WiFi / 热点。")
    print("        本窗口保持开启，按 Ctrl+C 停止服务。")
    print("=" * 56)

    # 自动打开扫码演示页
    try:
        threading.Timer(0.6, lambda: webbrowser.open(qr_url)).start()
    except Exception:
        pass

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止。")
        httpd.server_close()


if __name__ == "__main__":
    main()
