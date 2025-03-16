import { useState, useRef, useEffect } from 'react';
import styles from '../styles/SceneAnalyzer.module.css';
import PlaylistSection from './PlaylistSection';

export default function SceneAnalyzer() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sceneData, setSceneData] = useState(null);
  const [textInput, setTextInput] = useState('');
  const [showResults, setShowResults] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [spotifyToken, setSpotifyToken] = useState('');
  const [recommendedMusic, setRecommendedMusic] = useState([]);
  const [playingTrack, setPlayingTrack] = useState(null);
  const audioRef = useRef(null);
  const [previewError, setPreviewError] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [ripples, setRipples] = useState([]);
  const rippleCount = useRef(0);
  const resultsRef = useRef(null);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);

  const MAX_IMAGE_SIZE = 600;
  const MAX_FILE_SIZE = 2 * 1024 * 1024; // Reduced to 2MB
  const COMPRESSION_QUALITY = 0.6; // Increased compression ratio

  const compressImage = async (file, maxDimension = MAX_IMAGE_SIZE, quality = COMPRESSION_QUALITY) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calculate new dimensions while maintaining aspect ratio
          const aspectRatio = img.width / img.height;
          let { width, height } = img;
          const maxSize = Math.max(width, height);
          if (maxSize > maxDimension) {
            const ratio = maxDimension / maxSize;
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }

          // Create canvas for compression
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          // Use bilinear interpolation for scaling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to blob, use progressive JPEG
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Image compression failed'));
              return;
            }
            console.log('Original image size:', file.size, 'bytes');
            console.log('Compressed image size:', blob.size, 'bytes');
            console.log('Compression ratio:', Math.round((1 - blob.size / file.size) * 100) + '%');
            
            // If compressed image is still too large, continue compressing
            if (blob.size > MAX_FILE_SIZE) {
              console.log('Attempting further compression...');
              const newQuality = quality * 0.8;
              canvas.toBlob(
                (finalBlob) => {
                  if (!finalBlob) {
                    reject(new Error('Image secondary compression failed'));
                    return;
                  }
                  console.log('Secondary compression size:', finalBlob.size, 'bytes');
                  resolve(new File([finalBlob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                  }));
                },
                'image/jpeg',
                newQuality
              );
            } else {
              resolve(new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now()
              }));
            }
          });
        };
        img.onerror = () => reject(new Error('Image loading failed'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('File reading failed'));
      reader.readAsDataURL(file);
    });
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setError('');
      setLoading(true);

      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }

      if (file.size > MAX_FILE_SIZE * 3) {
        throw new Error('Image size cannot exceed 6MB');
      }

      // Process image
      let processedFile = file;
      if (file.size > MAX_FILE_SIZE || file.type !== 'image/jpeg') {
        console.log('Processing image...');
        processedFile = await compressImage(file);
        
        if (processedFile.size > MAX_FILE_SIZE) {
          console.log('Image still too large, performing secondary compression...');
          processedFile = await compressImage(processedFile, MAX_IMAGE_SIZE * 0.8, 0.5);
        }
      }

      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          console.log('Final image size:', img.width, 'x', img.height);
          console.log('Final file size:', processedFile.size, 'bytes');
          setImagePreview(reader.result);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(processedFile);
      setSelectedImage(processedFile);
    } catch (err) {
      console.error('Error processing image:', err);
      setError(err.message || 'Error processing image, please try again');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      setSelectedImage(file);
      setError('');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleCameraClick = (e) => {
    e.stopPropagation();
    if (isMobile) {
      cameraInputRef.current?.click();
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileClick = (e) => {
    e.stopPropagation(); // Prevent dropZone click event
    fileInputRef.current?.click();
  };

  // Get Spotify access token
  const getSpotifyToken = async () => {
    try {
      const response = await fetch('/api/spotify-token');
      if (!response.ok) {
        throw new Error(`Token request failed: ${response.status}`);
      }
      const data = await response.json();
      if (!data.access_token) {
        throw new Error('No access_token in response');
      }
      console.log('Successfully got Spotify token');
      setSpotifyToken(data.access_token);
    } catch (err) {
      console.error('Failed to get Spotify token:', err);
    }
  };

  // Get Spotify recommendations based on scene
  const getSpotifyRecommendations = async (scene) => {
    if (!spotifyToken) return null;
    
    const searchQuery = encodeURIComponent(`${scene} music`);
    try {
        // Increase limit to ensure enough songs can be filtered
        const response = await fetch(`https://api.spotify.com/v1/search?q=${searchQuery}&type=track&limit=50`, {
            headers: {
                'Authorization': `Bearer ${spotifyToken}`
            }
        });
        const data = await response.json();
        
        if (!data.tracks || !data.tracks.items) {
            console.error('No tracks found in Spotify response');
            return null;
        }
        
        // Use Set to track already selected artists and albums
        const selectedArtists = new Set();
        const selectedAlbums = new Set();
        const uniqueTracks = [];

        // Loop through all songs, select unique artists and albums
        for (const track of data.tracks.items) {
            const artistName = track.artists[0].name;
            const albumName = track.album.name;
            const trackName = track.name;
            
            // Skip non-English songs
            if (/[\u4e00-\u9fa5]/.test(trackName) || /[\u4e00-\u9fa5]/.test(artistName)) {
                continue;
            }
            
            // If artist or album has already been selected, skip this song
            if (selectedArtists.has(artistName) || selectedAlbums.has(albumName)) {
                continue;
            }
            
            // Get the largest album image
            const albumImage = track.album.images.sort((a, b) => b.width - a.width)[0];
            
            // Add to results
            uniqueTracks.push({
                id: track.id,
                name: trackName,
                artist: artistName,
                spotifyUrl: track.external_urls.spotify,
                previewUrl: track.preview_url,
                albumImageUrl: albumImage?.url,
                albumName: albumName,
                duration: track.duration_ms
            });
            
            // Record selected artists and albums
            selectedArtists.add(artistName);
            selectedAlbums.add(albumName);
            
            // If enough songs have been collected, stop
            if (uniqueTracks.length >= 6) {
                break;
            }
        }
        
        console.log('Tracks with images:', uniqueTracks.map(t => ({name: t.name, image: t.albumImageUrl})));
        return uniqueTracks;
    } catch (err) {
        console.error('Failed to get Spotify recommendations:', err);
        return null;
    }
  };

  const handleAnalyze = async (e) => {
    if (e) {
      e.preventDefault();
    }
    
    if (!selectedImage && !textInput.trim()) {
      setError('Please select an image or enter text');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const formData = new FormData();
      if (selectedImage) {
        console.log('添加图片到请求:', selectedImage.name, selectedImage.size, 'bytes');
        formData.append('image', selectedImage);
      }
      if (textInput.trim()) {
        console.log('添加文本到请求:', textInput.trim());
        formData.append('text', textInput.trim());
      }

      console.log('开始发送请求到服务器...');
      const response = await fetch('http://127.0.0.1:8080/analyze', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        },
        body: formData,
      });

      console.log('收到服务器响应:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('服务器错误响应:', errorText);
        throw new Error(`分析失败: ${response.status} - ${errorText || response.statusText}`);
      }

      const data = await response.json();
      console.log('解析响应数据:', data);
      setSceneData(data);
      setShowResults(true);
      
      if (data.scenes && data.scenes.length > 0) {
        const recommendations = await getSpotifyRecommendations(data.scenes[0].scene);
        if (recommendations) {
          setRecommendedMusic(recommendations);
        }
      }
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message || 'Analysis failed, please try again');
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (status, message) => {
    switch (status) {
      case 400:
        return 'Request format error: ' + message;
      case 502:
        return 'Server temporarily unavailable, retrying...';
      case 413:
        return 'Image file too large, please choose a smaller image or wait for compression.';
      case 415:
        return 'Unsupported file type, please use jpg, png or gif format.';
      case 429:
        return 'Too many requests, please try again later.';
      case 504:
        return 'Server timeout, retrying...';
      default:
        return `Server error (${status}): ${message}`;
    }
  };

  const handleTextChange = (e) => {
    setTextInput(e.target.value);
  };

  const handlePlay = async (track) => {
    try {
      setPreviewError(null);
      if (playingTrack?.name === track.name) {
        // If clicked song is currently playing, pause
        audioRef.current?.pause();
        setPlayingTrack(null);
      } else {
        // If there was a previously playing song, stop
        if (audioRef.current) {
          audioRef.current.pause();
        }

        // Check if there is a preview URL
        if (!track.previewUrl) {
          setPreviewError(track.name);
          console.log('This song does not have a preview audio');
          return;
        }

        // Create new audio instance
        audioRef.current = new Audio(track.previewUrl);
        audioRef.current.play().catch(err => {
          console.error('Play audio failed:', err);
          setPreviewError(track.name);
        });
        setPlayingTrack(track);
      }
    } catch (err) {
      console.error('Error processing play:', err);
      setPreviewError(track.name);
    }
  };

  // Detect if mobile device
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      setIsMobile(isMobileDevice);
    };
    checkMobile();
  }, []);

  // Get Spotify token when component loads
  useEffect(() => {
    getSpotifyToken();
  }, []);

  // Clean up audio when component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Generate random ripples
  const createRipple = () => {
    const x = Math.random() * 100; // Random x coordinate (0-100%)
    const y = Math.random() * 100; // Random y coordinate (0-100%)
    
    const newRipple = {
      id: rippleCount.current,
      style: {
        '--x': `${x}%`,
        '--y': `${y}%`
      }
    };
    
    rippleCount.current += 1;
    setRipples(prev => [...prev, newRipple]);
    
    // Ripple removed after animation ends
    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id));
    }, 4000);
  };

  // Periodically create new ripples
  useEffect(() => {
    // Create new ripples every few seconds
    const interval = setInterval(createRipple, 3000);
    // Initial create a ripple
    createRipple();
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.logoContainer}>
        <img
          src="/downloads/logo.PNG"
          alt="SceneSound Logo"
          className={styles.logo}
        />
      </div>
      <div className={styles.rippleContainer}>
        {ripples.map(ripple => (
          <div key={ripple.id} className={styles.ripple} style={ripple.style} />
        ))}
      </div>
      <div className={styles.content}>
        <h1 className={styles.title}>SceneSound</h1>
        
        <div className={`${styles.mainContent} ${showResults ? styles.hasContent : ''} w-full max-w-6xl mx-auto px-4`}>
          <div className={styles.uploadSection}>
            <div className={styles.imageUpload}>
              {imagePreview ? (
                <div className={styles.previewContainer}>
                  <img src={imagePreview} alt="Preview" className={styles.preview} />
                  <button onClick={() => {
                    setImagePreview(null);
                    setSelectedImage(null);
                  }} className={styles.clearButton}>
                    <span className={styles.clearIcon}>×</span>
                  </button>
                </div>
              ) : (
                <div className={styles.dropZone} onDrop={handleDrop} onDragOver={handleDragOver}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                    accept="image/*"
                    className={styles.fileInput}
                  />
                  {isMobile && (
                    <input
                      type="file"
                      ref={cameraInputRef}
                      onChange={handleImageSelect}
                      accept="image/*"
                      capture="environment"
                      className={styles.fileInput}
                    />
                  )}
                  <div className={styles.uploadOptions}>
                    <div className={styles.uploadIcon} onClick={handleFileClick}>
                      <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <span className={styles.iconText}>Choose File</span>
                    </div>
                    <div className={styles.cameraIcon} onClick={handleCameraClick}>
                      <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                      <span className={styles.iconText}>{isMobile ? 'Take Photo' : 'Choose File'}</span>
                    </div>
                  </div>
                  <p>Upload a photo or take a picture</p>
                </div>
              )}
            </div>

            <textarea
              className={styles.textInput}
              value={textInput}
              onChange={handleTextChange}
              placeholder="Enter text description here..."
            />

            <button 
              onClick={handleAnalyze} 
              className={styles.analyzeButton}
              disabled={loading}
            >
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>

            {error && (
              <div className={styles.error}>{error}</div>
            )}
          </div>

          <div className={`${styles.rightSection} ${showResults ? styles.visible : ''}`}>
            {sceneData && sceneData.scenes && (
              <div className={styles.scenesSection}>
                <h2 className={styles.sectionTitle}>Detected Scenes</h2>
                <div className={styles.scenesList}>
                  {sceneData.scenes.map((scene, index) => (
                    <div 
                      key={index} 
                      className={`${styles.sceneItem} ${styles[scene.source] || ''}`}
                    >
                      <span className={styles.sceneName}>{scene.scene}</span>
                      <span className={styles.sceneProb}>
                        {Math.round(scene.probability * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sceneData?.playlist && (
              <div className={styles.playlistSection}>
                {sceneData.playlist.length > 0 && (
                  <PlaylistSection playlist={sceneData.playlist} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showResults && (
        <div ref={resultsRef} className={styles.results}>
          {/* 结果内容 */}
        </div>
      )}
    </div>
  );
} 