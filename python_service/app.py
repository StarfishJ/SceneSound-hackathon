from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
from PIL import Image
import os
from places365_model import Places365Model
import logging
from dotenv import load_dotenv
import io
import gc
import time
import json
import random
import requests

# Scene to music style mapping
STYLE_MAPPINGS = {
    'nature': ['ambient', 'acoustic', 'folk'],
    'forest': ['ambient', 'acoustic', 'folk'],
    'mountain': ['ambient', 'folk', 'rock'],
    'garden': ['acoustic', 'classical', 'jazz'],
    'beach': ['tropical house', 'reggae', 'chill'],
    'ocean': ['ambient', 'classical', 'new age'],
    'sea': ['ambient', 'classical', 'new age'],
    'coast': ['tropical house', 'reggae', 'chill'],
    'city': ['electronic', 'pop', 'hip-hop'],
    'urban': ['electronic', 'hip-hop', 'r&b'],
    'street': ['hip-hop', 'jazz', 'funk'],
    'night': ['deep house', 'jazz', 'lofi'],
    'dark': ['electronic', 'ambient', 'industrial'],
    'party': ['dance', 'pop', 'electronic'],
    'dance': ['house', 'techno', 'pop'],
    'calm': ['classical', 'ambient', 'piano'],
    'peaceful': ['ambient', 'new age', 'classical'],
    'energetic': ['rock', 'electronic', 'pop'],
    'romantic': ['r&b', 'soul', 'jazz'],
    'melancholic': ['indie', 'alternative', 'acoustic'],
    'epic': ['orchestral', 'cinematic', 'rock'],
    'harbor': ['ambient', 'folk', 'acoustic'],
    'pier': ['acoustic', 'indie', 'folk'],
    'boat_deck': ['folk', 'acoustic', 'indie'],
    'general': ['pop', 'rock', 'electronic']
}

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()

app = Flask(__name__)

# Configure CORS
CORS(app, resources={
    r"/*": {
        "origins": "*",  # Allow all origins
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Accept", "Origin"]
    }
})

# Enable debug mode
app.debug = True

# Configure constants
MAX_IMAGE_SIZE = (800, 800)  # Maximum image size
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

# 设置音乐数据文件路径
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
TRACKS_FILE = os.path.join(CURRENT_DIR, '..', 'public', 'downloads', 'spotify', 'tracks.json')

# Initialize model
try:
    logger.info("Starting model initialization...")
    model = Places365Model()
    logger.info("Model initialization successful")
except Exception as e:
    logger.error(f"Model initialization failed: {str(e)}")
    raise

# Spotify API 配置
SPOTIFY_CLIENT_ID = os.getenv('SPOTIFY_CLIENT_ID')
SPOTIFY_CLIENT_SECRET = os.getenv('SPOTIFY_CLIENT_SECRET')
SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1'

# Spotify API 客户端
class SpotifyClient:
    def __init__(self):
        self._access_token = None
        self._token_expiry = 0
        
    def _get_access_token(self):
        """获取 Spotify API 访问令牌"""
        try:
            response = requests.post(
                SPOTIFY_TOKEN_URL,
                data={
                    'grant_type': 'client_credentials',
                    'client_id': SPOTIFY_CLIENT_ID,
                    'client_secret': SPOTIFY_CLIENT_SECRET,
                },
                headers={
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            )
            response.raise_for_status()
            data = response.json()
            return data['access_token']
        except Exception as e:
            logger.error(f"获取 Spotify 访问令牌失败: {str(e)}")
            return None

    def get_track_info(self, track_id):
        """获取歌曲详细信息"""
        max_retries = 3
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                if not self._access_token:
                    self._access_token = self._get_access_token()
                
                if not self._access_token:
                    logger.error("无法获取 Spotify 访问令牌")
                    return None
                
                response = requests.get(
                    f"{SPOTIFY_API_BASE_URL}/tracks/{track_id}",
                    headers={
                        'Authorization': f'Bearer {self._access_token}'
                    }
                )
                
                # 如果令牌过期，重新获取
                if response.status_code == 401:
                    logger.info("访问令牌过期，重新获取")
                    self._access_token = self._get_access_token()
                    retry_count += 1
                    continue
                
                response.raise_for_status()
                track_data = response.json()
                
                # 获取最大尺寸的专辑封面
                album_images = track_data.get('album', {}).get('images', [])
                album_image_url = None
                if album_images:
                    # 按宽度排序，获取最大的图片
                    album_images.sort(key=lambda x: x.get('width', 0), reverse=True)
                    album_image_url = album_images[0].get('url')
                
                # 获取预览 URL
                preview_url = track_data.get('preview_url')
                if preview_url:
                    # 验证预览 URL 是否可访问
                    try:
                        preview_response = requests.head(preview_url, timeout=2)
                        if preview_response.status_code != 200:
                            logger.warning(f"预览 URL 不可访问: {preview_url}")
                            preview_url = None
                    except Exception as e:
                        logger.warning(f"检查预览 URL 时出错: {str(e)}")
                        preview_url = None
                
                logger.info(f"成功获取歌曲信息 - Track ID: {track_id}, "
                          f"专辑封面: {'有' if album_image_url else '无'}, "
                          f"预览: {'有' if preview_url else '无'}")
                
                return {
                    'album_image_url': album_image_url,
                    'preview_url': preview_url
                }
                
            except requests.exceptions.RequestException as e:
                logger.error(f"请求 Spotify API 失败 (尝试 {retry_count + 1}/{max_retries}): {str(e)}")
                retry_count += 1
                if retry_count < max_retries:
                    time.sleep(1)  # 等待1秒后重试
                continue
            except Exception as e:
                logger.error(f"获取歌曲信息时发生错误: {str(e)}")
                return None
        
        logger.error(f"获取歌曲信息失败，已达到最大重试次数: {track_id}")
        return None

# 初始化 Spotify 客户端
spotify_client = SpotifyClient()

# HTML test page
HTML_TEMPLATE = '''
<!DOCTYPE html>
<html>
<head>
    <title>Scene Analysis Test</title>
    <meta charset="utf-8">
    <style>
        body { 
            font-family: Arial, sans-serif; 
            max-width: 100%;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
            height: 100vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        .form-group { 
            margin-bottom: 20px; 
        }
        #result { 
            margin-top: 20px;
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        .loading { 
            display: none; 
            color: #666; 
        }
        .error { 
            color: red; 
        }
        .status { 
            margin-top: 10px; 
            color: #666; 
        }
        .flex {
            display: flex;
            align-items: center;
            gap: 5px;
            justify-content: center;
            margin: 20px 0;
        }
        .scenes-list {
            margin-bottom: 20px;
        }
        .playlist-container {
            flex: 1;
            overflow-y: auto;
            margin: 0;
            padding: 0;
        }
        .playlist-container::-webkit-scrollbar {
            width: 8px;
        }
        .playlist-container::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 4px;
        }
        .playlist-container::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 4px;
        }
        .playlist-container::-webkit-scrollbar-thumb:hover {
            background: #555;
        }
        .playlist-item {
            padding: 10px;
            margin: 5px 0;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 4px;
            transition: background-color 0.2s;
        }
        .playlist-item:hover {
            background: rgba(255, 255, 255, 1);
        }
        .outer-cont {
            padding: 12px 20px;
            border: none;
            font-size: 1rem;
            cursor: pointer;
            position: relative;
            background: linear-gradient(90deg, #5bfcc4, #f593e4, #71a4f0);
            border-radius: 12px;
            color: #fff;
            transition: all 0.3s ease;
            box-shadow:
                inset 0px 0px 5px #ffffffa9,
                inset 0px 35px 30px #000,
                0px 5px 10px #000000cc;
            text-shadow: 1px 1px 1px #000;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .outer-cont::before {
            content: "";
            position: absolute;
            inset: 0;
            margin: auto;
            border-radius: 12px;
            filter: blur(0);
            z-index: -1;
            box-shadow: none;
            background: conic-gradient(
                #00000000 80deg,
                #40baf7,
                #f34ad7,
                #5bfcc4,
                #00000000 280deg
            );
            transition: all 0.3s ease;
        }
        .outer-cont:hover::before {
            filter: blur(15px);
        }
        .outer-cont:active::before {
            filter: blur(5px);
            transform: translateY(1px);
        }
        .outer-cont:active {
            box-shadow:
                inset 0px 0px 5px #ffffffa9,
                inset 0px 35px 30px #000;
            margin-top: 3px;
        }
        .outer-cont svg {
            width: 24px;
            height: 24px;
            fill: currentColor;
        }
    </style>
</head>
<body>
    <h1>Scene Analysis Test</h1>
    <form id="uploadForm">
        <div class="form-group">
            <label for="image">选择图片 (最大 5MB):</label>
            <input type="file" id="image" name="image" accept="image/*">
        </div>
        <div class="flex">
            <button type="submit" class="outer-cont" id="submitBtn">
                <svg viewBox="0 0 24 24" height="24" width="24" xmlns="http://www.w3.org/2000/svg">
                    <g fill="none">
                        <path d="m12.594 23.258l-.012.002l-.071.035l-.02.004l-.014-.004l-.071-.036q-.016-.004-.024.006l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.016-.018m.264-.113l-.014.002l-.184.093l-.01.01l-.003.011l.018.43l.005.012l.008.008l.201.092q.019.005.029-.008l.004-.014l-.034-.614q-.005-.019-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.003-.011l.018-.43l-.003-.012l-.01-.01z"></path>
                        <path d="M9.107 5.448c.598-1.75 3.016-1.803 3.725-.159l.06.16l.807 2.36a4 4 0 0 0 2.276 2.411l.217.081l2.36.806c1.75.598 1.803 3.016.16 3.725l-.16.06l-2.36.807a4 4 0 0 0-2.412 2.276l-.081.216l-.806 2.361c-.598 1.75-3.016 1.803-3.724.16l-.062-.16l-.806-2.36a4 4 0 0 0-2.276-2.412l-.216-.081l-2.36-.806c-1.751-.598-1.804-3.016-.16-3.724l.16-.062l2.36-.806A4 4 0 0 0 8.22 8.025l.081-.216zM11 6.094l-.806 2.36a6 6 0 0 1-3.49 3.649l-.25.091l-2.36.806l2.36.806a6 6 0 0 1 3.649 3.49l.091.25l.806 2.36l.806-2.36a6 6 0 0 1 3.49-3.649l.25-.09l2.36-.807l-2.36-.806a6 6 0 0 1-3.649-3.49l-.09-.25zM19 2a1 1 0 0 1 .898.56l.048.117l.35 1.026l1.027.35a1 1 0 0 1 .118 1.845l-.118.048l-1.026.35l-.35 1.027a1 1 0 0 1-1.845.117l-.048-.117l-.35-1.026l-1.027-.35a1 1 0 0 1-.118-1.845l.118-.048l1.026-.35l.35-1.027A1 1 0 0 1 19 2" fill="currentColor"></path>
                    </g>
                </svg>
                分析
            </button>
        </div>
        <div id="loading" class="loading">处理中，请稍候...</div>
        <div id="status" class="status"></div>
    </form>
    <div id="result"></div>

    <script>
        const form = document.getElementById('uploadForm');
        const loading = document.getElementById('loading');
        const result = document.getElementById('result');
        const imageInput = document.getElementById('image');
        const status = document.getElementById('status');
        const submitBtn = document.getElementById('submitBtn');

        // Check server status
        async function checkHealth() {
            try {
                const response = await fetch('/health');
                const data = await response.json();
                status.textContent = `服务器状态: ${data.status}`;
            } catch (error) {
                status.textContent = `服务器连接失败: ${error.message}`;
            }
        }

        // Periodically check server status
        checkHealth();
        setInterval(checkHealth, 30000);

        imageInput.onchange = function() {
            const file = this.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) {
                    result.innerHTML = '<div class="error">错误：图片大小不能超过5MB</div>';
                    this.value = '';
                    return;
                }
                if (!file.type.startsWith('image/')) {
                    result.innerHTML = '<div class="error">错误：请选择图片文件</div>';
                    this.value = '';
                    return;
                }
                status.textContent = `已选择图片: ${file.name}, 大小: ${(file.size/1024).toFixed(2)}KB`;
            }
        };

        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData();
            const imageFile = imageInput.files[0];
            
            if (!imageFile) {
                result.innerHTML = '<div class="error">错误：请选择图片</div>';
                return;
            }
            
            formData.append('image', imageFile);
            loading.style.display = 'block';
            result.innerHTML = '';
            status.textContent = '正在上传图片...';
            submitBtn.disabled = true;  // 禁用按钮防止重复提交
            
            try {
                const startTime = Date.now();
                
                // 添加超时处理
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 60000); // 增加到60秒超时
                
                status.textContent = '正在发送请求...';
                console.log('开始发送分析请求...');
                const response = await fetch('/analyze', {
                    method: 'POST',
                    body: formData,
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                console.log('收到服务器响应:', response.status);
                clearTimeout(timeoutId);
                status.textContent = '正在处理响应...';
                
                const responseText = await response.text();
                console.log('响应内容:', responseText);
                
                let data;
                try {
                    data = JSON.parse(responseText);
                } catch (parseError) {
                    console.error('JSON解析错误:', parseError);
                    throw new Error('服务器响应格式错误');
                }
                
                const endTime = Date.now();
                
                if (!response.ok) {
                    console.error('服务器错误:', response.status, data);
                    throw new Error(data.error || `服务器错误: ${response.status}`);
                }
                
                if (!data.success) {
                    console.error('处理失败:', data.error);
                    throw new Error(data.error || '处理失败，请重试');
                }
                
                console.log('分析结果:', data);
                
                // 格式化显示结果
                let resultHtml = '<div style="margin-top: 20px;">';
                
                // 显示场景
                if (data.scenes && data.scenes.length > 0) {
                    resultHtml += '<h3>识别到的场景：</h3>';
                    resultHtml += '<ul class="scenes-list">';
                    data.scenes.forEach(scene => {
                        resultHtml += `<li>${scene.scene} (置信度: ${(scene.probability * 100).toFixed(2)}%)</li>`;
                    });
                    resultHtml += '</ul>';
                }
                
                // 显示播放列表（无标题）
                if (data.playlist && data.playlist.length > 0) {
                    resultHtml += '<div class="playlist-container">';
                    data.playlist.forEach(track => {
                        resultHtml += `<div class="playlist-item">${track.name} - ${track.artist}</div>`;
                    });
                    resultHtml += '</div>';
                } else {
                    resultHtml += '<p>未找到匹配的音乐</p>';
                }
                
                resultHtml += '</div>';
                result.innerHTML = resultHtml;
                status.textContent = `分析完成，用时：${((endTime - startTime)/1000).toFixed(2)}秒`;
            } catch (error) {
                console.error('请求错误:', error);
                if (error.name === 'AbortError') {
                    result.innerHTML = `<div class="error">错误：请求超时，请重试</div>`;
                    status.textContent = '请求超时';
                } else {
                    result.innerHTML = `<div class="error">错误：${error.message}</div>`;
                    status.textContent = '处理失败';
                }
            } finally {
                loading.style.display = 'none';
                submitBtn.disabled = false;  // 重新启用按钮
            }
        };
    </script>
</body>
</html>
'''

@app.route('/', methods=['GET'])
def index():
    logger.info("Accessing root route /")
    try:
        return render_template_string(HTML_TEMPLATE)
    except Exception as e:
        logger.error(f"Template rendering failed: {str(e)}")
        return str(e), 500

@app.route('/test', methods=['GET'])
def test():
    logger.info("Accessing test route /test")
    return "Server is running"

def process_image(image_file):
    """Process uploaded image, including size check and compression"""
    try:
        logger.info("开始处理图片...")
        # Check file size
        image_file.seek(0, io.SEEK_END)
        file_size = image_file.tell()
        image_file.seek(0)
        
        logger.info(f"原始图片大小: {file_size/1024:.2f}KB")
        
        if file_size > MAX_FILE_SIZE:
            raise ValueError('Image file too large (max 5MB)')
        
        # Use PIL's efficient read mode
        image = Image.open(image_file)
        logger.info(f"图片格式: {image.format}, 尺寸: {image.size}, 模式: {image.mode}")
        
        # Check image format
        if image.format not in ['JPEG', 'PNG', 'WebP']:
            raise ValueError(
                'Unsupported image format. Please use JPEG, PNG or WebP'
            )
            
        # Convert to RGB mode (if needed) and immediately release original image
        if image.mode != 'RGB':
            logger.info(f"转换图片模式从 {image.mode} 到 RGB")
            new_image = image.convert('RGB')
            image.close()
            image = new_image
            
        # If image is too large, resize it
        if (image.size[0] > MAX_IMAGE_SIZE[0] or 
            image.size[1] > MAX_IMAGE_SIZE[1]):
            # Calculate resize ratio
            ratio = min(
                MAX_IMAGE_SIZE[0] / image.size[0],
                MAX_IMAGE_SIZE[1] / image.size[1]
            )
            new_size = (
                int(image.size[0] * ratio),
                int(image.size[1] * ratio)
            )
            logger.info(f"调整图片尺寸从 {image.size} 到 {new_size}")
            # Resize and immediately release original image
            new_image = image.resize(new_size, Image.Resampling.LANCZOS)
            image.close()
            image = new_image
            
        # Force load image data into memory and release file handle
        image.load()
        image_file.close()
        
        # Active garbage collection
        gc.collect()
        
        logger.info("图片处理完成")
        return image
    except Exception as e:
        logger.error(f"图片处理失败: {str(e)}", exc_info=True)
        if image_file and not image_file.closed:
            image_file.close()
        if 'image' in locals():
            image.close()
        gc.collect()
        raise

@app.after_request
def after_request(response):
    """Handle CORS response headers"""
    origin = request.headers.get('Origin')
    
    # Allow local development and production environments
    if origin:
        response.headers.update({
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Origin',
            'Access-Control-Expose-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        })
    
    # Handle preflight request
    if request.method == 'OPTIONS':
        return response
    
    return response

@app.route('/analyze', methods=['POST'])
def analyze():
    logger.info("received analyze request")
    logger.debug(f"request headers: {dict(request.headers)}")
    logger.debug(f"file: {request.files}")
    logger.debug(f"form data: {request.form}")
    
    try:
        if 'image' not in request.files and 'text' not in request.form:
            logger.error("no image or text in request")
            return jsonify({
                'error': 'please provide an image or text description',
                'success': False
            }), 400

        # Process image
        scenes = []
        if 'image' in request.files:
            image_file = request.files['image']
            if not image_file.filename:
                logger.error("image file name is empty")
                return jsonify({
                    'error': 'invalid image file',
                    'success': False
                }), 400

            try:
                logger.info(f"processing image: {image_file.filename}")
                image = process_image(image_file)
                logger.info(f"image processed: {image.size}")
                
                # Analyze image
                logger.info("starting scene analysis...")
                scenes = model.predict(image)
                logger.info(f"scene analysis completed: {scenes}")
                
                # Add source marker
                for scene in scenes:
                    scene['source'] = 'image'
                
            except Exception as e:
                logger.error(f"image processing or analysis failed: {str(e)}", exc_info=True)
                return jsonify({
                    'error': f'image processing failed: {str(e)}',
                    'success': False
                }), 400

        # Process text
        if 'text' in request.form:
            text = request.form['text'].strip()
            if text:
                # Simple text analysis: directly use text as scene
                text_scene = {
                    'scene': text,
                    'probability': 1.0,
                    'source': 'text'
                }
                scenes.append(text_scene)
                logger.info(f"Added text scene: {text_scene}")

        if not scenes:
            logger.warning("No scenes generated")
        return jsonify({
                'error': 'Unable to recognize scene',
            'success': False
        }), 400

        # Get music recommendation
        try:
            seen_track_uris = set()
            logger.info(f"attempting to read music data file: {TRACKS_FILE}")
            if not os.path.exists(TRACKS_FILE):
                logger.error(f"music data file does not exist: {TRACKS_FILE}")
                return jsonify({
                    'error': 'music data file does not exist',
                    'success': False
                }), 500
            
            with open(TRACKS_FILE, 'r', encoding='utf-8') as f:
                try:
                    data = json.load(f)
                except json.JSONDecodeError as e:
                    logger.error(f"music data file format error: {str(e)}")
                    return jsonify({
                        'error': 'music data file format error',
                        'success': False
                    }), 500
                    
                playlists = data.get('playlists', [])
                if not playlists:
                    logger.warning("music data file has no playlists")
                    return jsonify({
                        'error': 'no available music data',
                        'success': False
                    }), 500
                
                # collect all tracks
                all_tracks = []
                for playlist in playlists:
                    tracks = playlist.get('tracks', [])
                    all_tracks.extend(tracks)
                
                logger.info(f"loaded {len(all_tracks)} tracks")
                
                # extract tags from scenes
                input_tags = []
                for scene in scenes:
                    scene_tags = scene['scene'].lower().split()
                    input_tags.extend(scene_tags)
                
                logger.info(f"input tags: {input_tags}")
                
                # calculate match score for each track
                scored_tracks = []
                for track in all_tracks:
                    if isinstance(track, str):
                        continue
                    
                    track_uri = track.get('track_uri')
                    if not track_uri or track_uri in seen_track_uris:
                        continue
                        
                    track_tags = track.get('tags', [])
                    logger.info(f"\nchecking track: {track.get('track_name', 'Unknown')}")
                    logger.info(f"track tags: {track_tags}")
                    
                    # calculate match count
                    matched_tags = [tag for tag in track_tags if tag.lower() in input_tags]
                    match_count = len(matched_tags)
                    
                    if match_count > 0:  # only add tracks with matches
                        scored_tracks.append({
                            **track,
                            'match_count': match_count,
                            'matched_tags': matched_tags
                        })
                        seen_track_uris.add(track_uri)  # record added tracks
                
                # sort by match count
                matched_tracks = sorted(scored_tracks, 
                                     key=lambda x: x['match_count'], 
                                     reverse=True)[:12]
                
                logger.info(f"selected {len(matched_tracks)} tracks with highest match count")
                
                # format track info
                playlist = []
                for track in matched_tracks:
                    try:
                        track_uri = track.get('track_uri', '')
                        track_id = track_uri.split(':')[-1] if track_uri else ''
                        
                        # get track info
                        track_info = None
                        if track_id:
                            track_info = spotify_client.get_track_info(track_id)
                        
                        album_image_url = (track_info.get('album_image_url') 
                                        if track_info and track_info.get('album_image_url') 
                                        else '/default-album.png')
                        preview_url = track_info.get('preview_url') if track_info else None
                        
                        playlist.append({
                            'id': track_uri,
                            'name': track.get('track_name', ''),
                            'artist': track.get('artist_name', ''),
                            'albumName': track.get('album_name', ''),
                            'duration': track.get('duration_ms', 0),
                            'pos': len(playlist),
                            'albumImageUrl': album_image_url,
                            'spotifyUrl': f"https://open.spotify.com/track/{track_id}" if track_id else None,
                            'previewUrl': preview_url,
                            'matchCount': track['match_count'],
                            'matchedTags': track['matched_tags']
                        })
                        

                        logger.info(f"added track to playlist: {track.get('track_name')} (matched tags: {track['matched_tags']})")
                        
                    except Exception as e:
                        logger.error(f"error processing single track: {str(e)}")
                        continue
            logger.info(f"Final selected {len(playlist)} recommended songs")
        except Exception as e:
            logger.error(f"Music recommendation failed: {str(e)}")
            logger.error(f"Error details: {e.__class__.__name__}: {str(e)}")
            logger.error(f"Current working directory: {os.getcwd()}")
            playlist = []

        response_data = {
            'success': True,
            'scenes': scenes,
            'styles': [],  # No longer return style list
            'playlist': playlist
        }
        logger.info(f"Returning response: {response_data}")
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}", exc_info=True)
        return jsonify({
            'error': f'Server error: {str(e)}',
            'success': False
        }), 500

# Add health check endpoint
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    logger.info("Health check request")
    return jsonify({
        "status": "healthy",
        "model_loaded": hasattr(app, 'model')
    })

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8080, debug=True) 