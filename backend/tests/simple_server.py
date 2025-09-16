#!/usr/bin/env python3
"""
간단한 로컬 API 서버
썸네일 생성 기능 테스트용
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import os
import sys
import io
from urllib.parse import urlparse, parse_qs
from test_func_local import local_photo_upload_handler
from test_func_unified import handler_unified

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
                "endpoints": ["/api/health", "/api/photos/upload", "/api/photos", "/storage/*"]
            }
            self.send_json_response(200, response_data)
        elif parsed_path.path == '/api/photos':
            # 사진 목록 조회
            query_params = parse_qs(parsed_path.query)
            limit = int(query_params.get('limit', ['20'])[0])
            page = query_params.get('page', [None])[0]
            order_by = query_params.get('order_by', ['upload_timestamp'])[0]
            order = query_params.get('order', ['DESC'])[0]

            try:
                from test_func_unified import get_photo_list
                result = get_photo_list(limit, page, order_by, order)
                self.send_json_response(200, result)

            except Exception as e:
                error_response = {
                    "success": False,
                    "message": f"Photo list error: {str(e)}"
                }
                self.send_json_response(500, error_response)
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

                # 환경변수 STORAGE_TYPE에 따라 핸들러 선택
                storage_type = os.getenv('STORAGE_TYPE', 'OCI')

                if storage_type == 'OCI':
                    # OCI 스토리지 사용 - 간단한 OCI 업로드 핸들러
                    result = self.handle_oci_upload(request_data)
                else:
                    # 로컬 스토리지 사용
                    result = local_photo_upload_handler(request_data)

                self.send_response(result['statusCode'])
                for header, value in result['headers'].items():
                    self.send_header(header, value)
                self.end_headers()
                self.wfile.write(result['body'].encode('utf-8'))

            except Exception as e:
                error_response = {
                    "success": False,
                    "message": f"Upload error: {str(e)}"
                }
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(error_response).encode('utf-8'))

        elif parsed_path.path == '/api/photos/upload-unified':
            # 통합 스토리지 서비스 엔드포인트
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)

            try:
                request_data = json.loads(post_data.decode('utf-8'))
                result = handler_unified(request_data)

                # 간단한 응답 형식으로 변환
                status_code = result.get('status', 500)
                response_data = {
                    'success': status_code < 400,
                    'message': result.get('message', ''),
                    'data': result.get('data', None),
                    'status': status_code
                }

                self.send_response(status_code)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
                self.end_headers()

                self.wfile.write(json.dumps(response_data, ensure_ascii=False).encode('utf-8'))

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

    def handle_oci_upload(self, request_data):
        """OCI Object Storage 업로드 핸들러"""
        try:
            import base64
            import uuid
            from datetime import datetime

            # 상위 디렉토리를 Python 경로에 추가
            sys.path.append('../')
            from shared.oci_client import OCIObjectStorageClient
            from shared.thumbnail_generator import ThumbnailGenerator
            from shared.utils import generate_photo_id, validate_image_file, get_file_extension

            # 필수 필드 검증
            required_fields = ['filename', 'file_data', 'content_type']
            missing_fields = [field for field in required_fields if field not in request_data]

            if missing_fields:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        "success": False,
                        "message": f"Missing required fields: {missing_fields}"
                    })
                }

            # 파일 데이터 처리
            filename = request_data['filename']
            file_data_b64 = request_data['file_data']
            content_type = request_data['content_type']
            description = request_data.get('description', '')

            # Base64 디코딩
            try:
                if file_data_b64.startswith('data:'):
                    header, file_data_b64 = file_data_b64.split(',', 1)
                file_content = base64.b64decode(file_data_b64)
            except Exception as e:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        "success": False,
                        "message": f"Invalid file data: {str(e)}"
                    })
                }

            # 파일 유효성 검사
            is_valid, validation_message = validate_image_file(file_content, filename, 50*1024*1024)
            if not is_valid:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        "success": False,
                        "message": validation_message
                    })
                }

            # 고유 ID 및 파일명 생성
            photo_id = generate_photo_id()
            file_extension = get_file_extension(filename)
            object_name = f"photos/{photo_id}.{file_extension}"

            print(f"🚀 OCI 업로드 시작: {photo_id}")

            # Object Storage에 업로드
            storage_client = OCIObjectStorageClient()
            upload_result = storage_client.upload_file(
                file_content=file_content,
                object_name=object_name,
                content_type=content_type,
                metadata={
                    'photo_id': photo_id,
                    'original_filename': filename,
                    'description': description
                }
            )

            if not upload_result['success']:
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        "success": False,
                        "message": f"File upload failed: {upload_result['error']}"
                    })
                }

            print(f"✅ 원본 파일 업로드 성공: {upload_result['url']}")

            # 썸네일 생성 및 업로드
            thumbnail_urls = {}
            try:
                thumbnail_generator = ThumbnailGenerator()
                thumbnails = thumbnail_generator.create_thumbnails(file_content)
                print(f"📸 썸네일 생성 완료: {list(thumbnails.keys())}")

                # 각 썸네일을 Object Storage에 업로드
                for size_name, thumbnail_info in thumbnails.items():
                    thumbnail_object_name = f"thumbnails/{photo_id}_{size_name}.jpg"

                    thumbnail_upload_result = storage_client.upload_file(
                        file_content=thumbnail_info['data'],
                        object_name=thumbnail_object_name,
                        content_type='image/jpeg',
                        metadata={
                            'photo_id': photo_id,
                            'thumbnail_size': size_name,
                            'width': str(thumbnail_info['width']),
                            'height': str(thumbnail_info['height']),
                            'generated_by': 'backend'
                        }
                    )

                    if thumbnail_upload_result['success']:
                        thumbnail_urls[size_name] = thumbnail_upload_result['url']
                        print(f"✅ 썸네일 {size_name} 업로드 성공")
                    else:
                        print(f"❌ 썸네일 {size_name} 업로드 실패: {thumbnail_upload_result.get('error')}")

            except Exception as e:
                print(f"⚠️ 썸네일 생성 실패: {str(e)}")

            # 성공 응답
            response_data = {
                'photo_id': photo_id,
                'filename': filename,
                'file_url': upload_result['url'],
                'thumbnail_urls': thumbnail_urls,
                'file_size': len(file_content),
                'thumbnails_generated': len(thumbnail_urls)
            }

            return {
                'statusCode': 201,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    "success": True,
                    "message": "Photo uploaded successfully",
                    "data": response_data
                })
            }

        except Exception as e:
            print(f"❌ OCI 업로드 오류: {str(e)}")
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    "success": False,
                    "message": f"Upload error: {str(e)}"
                })
            }

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
    # 스토리지 타입 자동 감지
    import os

    if 'STORAGE_TYPE' not in os.environ:
        # OCI 환경변수가 설정되어 있으면 OCI 사용, 아니면 LOCAL 사용
        if os.getenv('OCI_NAMESPACE') and os.getenv('OCI_BUCKET_NAME'):
            os.environ['STORAGE_TYPE'] = 'OCI'
            print("🔧 OCI 환경변수 감지: STORAGE_TYPE을 OCI로 설정")
        else:
            os.environ['STORAGE_TYPE'] = 'LOCAL'
            print("🔧 로컬 테스트 환경: STORAGE_TYPE을 LOCAL로 설정")
    else:
        print(f"🔧 환경변수 STORAGE_TYPE: {os.environ['STORAGE_TYPE']}")

    run_server(8001)