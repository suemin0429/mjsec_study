"""TMDB 프록시 서버.

API 키는 서버의 .env 에만 두고, 브라우저는 /api/* 만 호출한다.
실행: pip install -r requirements.txt && python app.py  →  http://127.0.0.1:5001
(macOS 는 5000번 포트를 AirPlay 수신이 쓰고 있어서 5001 을 쓴다.)
"""
import json
import os
import re
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from dotenv import load_dotenv
from flask import Flask, abort, jsonify, request, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "whatyouwant"
TMDB_BASE_URL = "https://api.themoviedb.org/3"

load_dotenv(BASE_DIR / ".env")
API_KEY = os.getenv("TMDB_API_KEY")

# static_folder=None: 폴더 전체를 자동 공개하지 않고 아래 화이트리스트 파일만 내보낸다.
app = Flask(__name__, static_folder=None)
PUBLIC_FILES = {"index.html", "script.js", "style.css"}
PORT = 5001

# VS Code Live Server(Go Live, 보통 5500 포트) 같은 로컬 페이지에서만 /api 호출을 허용한다.
LOCAL_ORIGIN = re.compile(r"^http://(localhost|127\.0\.0\.1):\d+$")


@app.after_request
def allow_local_origin(response):
    origin = request.headers.get("Origin", "")
    if request.path.startswith("/api/") and LOCAL_ORIGIN.match(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
    return response


def tmdb_get(path, **params):
    """TMDB 를 호출해 (응답 JSON, 상태코드) 를 돌려준다."""
    if not API_KEY:
        return {"error": "서버에 TMDB_API_KEY 가 설정되지 않았습니다."}, 500

    query = urlencode({"api_key": API_KEY, "language": "ko-KR", **params})
    try:
        with urlopen(f"{TMDB_BASE_URL}{path}?{query}", timeout=5) as res:
            return json.load(res), 200
    except HTTPError as e:
        # 401: 키 오류, 429: 요청 과다 등. TMDB 원본 메시지는 키가 섞일 수 있어 그대로 넘기지 않는다.
        return {"error": f"TMDB 요청 실패 (HTTP {e.code})"}, 502
    except (URLError, TimeoutError):
        return {"error": "TMDB 서버에 연결할 수 없습니다."}, 504


@app.get("/api/popular")
def popular():
    data, status = tmdb_get("/movie/popular")
    return jsonify(data), status


@app.get("/api/search")
def search():
    query = request.args.get("query", "").strip()
    if not query:
        return jsonify({"error": "검색어가 비어 있습니다."}), 400
    data, status = tmdb_get("/search/movie", query=query)
    return jsonify(data), status


@app.get("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")


@app.get("/<path:filename>")
def static_files(filename):
    if filename not in PUBLIC_FILES:
        abort(404)
    return send_from_directory(STATIC_DIR, filename)


if __name__ == "__main__":
    app.run(port=PORT, debug=True)
