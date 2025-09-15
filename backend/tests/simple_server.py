#!/usr/bin/env python3
"""
간단한 로컬 API 서버
썸네일 생성 기능 테스트용
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import os
from urllib.parse import urlparse, parse_qs
from test_func_local import local_photo_upload_handler

class PhotoAPIHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """CORS preflight 요청 처리"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_GET(self):
        """GET 요청 처리"""
        parsed_path = urlparse(self.path)

        if parsed_path.path == '/api/health':
            response_data = {
                "success": True,
                "message": "Server is running",
                "version": "1.0.0",
                "endpoints": ["/api/health", "/api/photos/upload", "/storage/*"]
            }
            self.send_json_response(200, response_data)
        elif parsed_path.path.startswith('/storage/'):
            # 정적 파일 서빙 (photos, thumbnails)
            self.serve_static_file(parsed_path.path)
        else:
            self.send_error(404, "Not Found")

    def serve_static_file(self, path):
        """정적 파일 서빙"""
        # /storage/photos/xxx.jpg -> /tmp/photolog-storage/photos/xxx.jpg
        # /storage/thumbnails/xxx.jpg -> /tmp/photolog-storage/thumbnails/xxx.jpg
        storage_path = path.replace('/storage/', '/tmp/photolog-storage/')

        if os.path.exists(storage_path) and os.path.isfile(storage_path):
            try:
                with open(storage_path, 'rb') as f:
                    content = f.read()

                # MIME 타입 결정
                if storage_path.endswith('.jpg') or storage_path.endswith('.jpeg'):
                    content_type = 'image/jpeg'
                elif storage_path.endswith('.png'):
                    content_type = 'image/png'
                else:
                    content_type = 'application/octet-stream'

                self.send_response(200)
                self.send_header('Content-Type', content_type)
                self.send_header('Content-Length', str(len(content)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(content)

            except Exception as e:
                print(f"Error serving file {storage_path}: {e}")
                self.send_error(500, "Internal Server Error")
        else:
            self.send_error(404, "File Not Found")

    def do_POST(self):
        """POST 요청 처리"""
        parsed_path = urlparse(self.path)

        if parsed_path.path == '/api/photos/upload':
            # 요청 본문 읽기
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)

            try:
                request_data = json.loads(post_data.decode('utf-8'))
                result = local_photo_upload_handler(request_data)

                self.send_response(result['statusCode'])
                for header, value in result['headers'].items():
                    self.send_header(header, value)
                self.end_headers()

                self.wfile.write(result['body'].encode('utf-8'))

            except Exception as e:
                error_response = {
                    "success": False,
                    "message": f"Server error: {str(e)}"
                }
                self.send_json_response(500, error_response)
        else:
            self.send_error(404, "Not Found")

    def send_json_response(self, status_code, data):
        """JSON 응답 전송"""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

        response_json = json.dumps(data, ensure_ascii=False)
        self.wfile.write(response_json.encode('utf-8'))

    def log_message(self, format, *args):
        """로그 메시지 출력"""
        print(f"[{self.address_string()}] {format % args}")

def run_server(port=8000):
    """서버 실행"""
    server_address = ('', port)
    httpd = HTTPServer(server_address, PhotoAPIHandler)
    print(f"🚀 로컬 API 서버 실행 중: http://localhost:{port}")
    print("📡 사용 가능한 엔드포인트:")
    print("   GET  /api/health")
    print("   POST /api/photos/upload")
    print("⏹️  서버 중지: Ctrl+C")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 서버 중지됨")
        httpd.server_close()

if __name__ == "__main__":
    run_server(8000)