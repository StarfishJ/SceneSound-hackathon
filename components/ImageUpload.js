import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function ImageUpload({ onAnalyze }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [lastApiResponse, setLastApiResponse] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('Selected file:', file);
    } else {
      console.log('No file selected');
      return;
    }

    // Check file type
    console.log('File type:', file.type);
    if (!file.type.startsWith('image/')) {
      console.log('File type is not an image');
      setError('Please select an image file');
      return;
    }

    // Check file size
    console.log('File size:', file.size);
    if (file.size > MAX_FILE_SIZE) {
      console.log('File is too large');
      setError('Image size cannot exceed 5MB');
      return;
    }

    setError(null);

    // Create file reader
    const reader = new FileReader();

    reader.onloadstart = () => {
      console.log('Start reading image');
    };

    reader.onprogress = (e) => {
      console.log(`Reading progress: ${(e.loaded / e.total * 100).toFixed(2)}%`);
    };

    reader.onload = () => {
      const dataUrl = reader.result;
      console.log('Image reading complete, setting preview URL');
      console.log('Preview URL starts with:', dataUrl.substring(0, 50) + '...');
      console.log('Is base64 format:', dataUrl.startsWith('data:image/'));
      setPreviewUrl(dataUrl);
    };

    reader.onerror = (e) => {
      console.error('Image reading error:', e);
      setError('Failed to read image file');
    };

    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!selectedImage) {
      setError('Please select an image');
      return;
    }

    setLoading(true);
    setError('');
    setKeywords([]); // Clear previous keywords

    try {
      const formData = new FormData();
      formData.append('image', selectedImage);

      console.log('Starting request...');
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      console.log('Received response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorData = await response.json().catch(e => {
          console.error('Failed to parse error response:', e);
          return {};
        });
        console.error('HTTP error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(errorData.error || `Request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json().catch(e => {
        console.error('Failed to parse response data:', e);
        throw new Error('Unable to parse server response');
      });

      console.log('Full API response:', JSON.stringify(data, null, 2));

      if (!data.success || !data.data) {
        console.error('API returned error:', data);
        throw new Error(data.error || 'Analysis failed');
      }

      const { scenes, styles, playlist } = data.data;
      
      // Validate scene data
      if (!Array.isArray(scenes)) {
        console.error('Scene data is not an array:', scenes);
        throw new Error('Scene data format error');
      }

      if (scenes.length === 0) {
        console.warn('No scenes recognized');
        setKeywords([]);
        return;
      }

      // Extract and validate scene data
      const topScenes = scenes
        .slice(0, 3)
        .map(item => {
          if (!item || typeof item !== 'object') {
            console.warn('Invalid scene item:', item);
            return null;
          }
          
          const { scene, probability } = item;
          if (typeof scene !== 'string' || typeof probability !== 'number') {
            console.warn('Scene data format error:', item);
            return null;
          }

          return {
            name: scene,
            probability: (probability * 100).toFixed(1)
          };
        })
        .filter(Boolean);

      console.log('Processed scene data:', JSON.stringify(topScenes, null, 2));

      if (topScenes.length === 0) {
        console.warn('No valid scene data');
        setKeywords([]);
        return;
      }

      // Update state
      setKeywords(topScenes);
      setLastApiResponse(data);

      if (onAnalyze) {
        onAnalyze(data.data);
      }
    } catch (error) {
      console.error('Detailed error information:', error);
      setError(error.message || 'Error occurred during upload');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {/* Left upload and preview area */}
      <div className="w-full max-w-xl">
        <label className="block mb-2 text-sm font-medium text-gray-900">
          Upload image
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
        />

        {/* Preview area */}
        <div className="mt-4">
          <div className="relative w-full h-64 rounded-lg overflow-hidden shadow-lg bg-gray-100">
            {previewUrl ? (
              <div className="w-full h-full flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Preview image"
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    console.error('Image loading error:', e);
                    console.log('Failed image URL starts with:', previewUrl.substring(0, 50) + '...');
                    setError('Failed to load image');
                  }}
                  onLoad={() => {
                    console.log('Image loaded successfully');
                  }}
                />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-gray-400">Please select an image</span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="text-red-500 text-sm mt-2">{error}</div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!selectedImage || loading}
          className={`mt-4 w-full px-6 py-2 rounded-lg shadow-md transition-all duration-200 ${
            !selectedImage || loading
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white hover:shadow-lg'
          }`}
        >
          {loading ? 'Analyzing...' : 'Start analysis'}
        </button>
      </div>

      {/* Right analysis result area */}
      <div className="w-full max-w-xl mt-8">
        {/* Scene keyword card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Scene analysis result</h2>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
            </div>
          ) : keywords.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {keywords.map((keyword, index) => (
                  <div
                    key={index}
                    className="bg-blue-50 rounded-lg p-4 flex flex-col items-center"
                  >
                    <span className="text-lg font-medium text-blue-700">
                      {keyword.name}
                    </span>
                    <span className="text-sm text-blue-500 mt-1">
                      Confidence: {keyword.probability}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No scene analysis result yet</p>
          )}
        </div>

        {/* Recommended music card */}
        {lastApiResponse?.data?.playlist && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recommended music</h2>
            <div className="grid grid-cols-1 gap-4">
              {lastApiResponse.data.playlist.map((track, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-4 bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                >
                  {track.albumImage && (
                    <div className="flex-shrink-0">
                      <img
                        src={track.albumImage}
                        alt={track.name}
                        className="w-16 h-16 rounded-md shadow-sm object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div className="flex-grow min-w-0">
                    <h3 className="text-lg font-medium text-gray-900 truncate">
                      {track.name}
                    </h3>
                    <p className="text-gray-500 truncate">{track.artist}</p>
                  </div>
                  {track.spotifyUrl && (
                    <a
                      href={track.spotifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 p-2 text-green-500 hover:text-green-700 transition-colors"
                    >
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                      </svg>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Debug panel */}
      <div className="w-full max-w-xl mt-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Debug information</h2>
          <div className="space-y-4">
            {error && (
              <div className="p-4 bg-red-50 rounded-lg">
                <h4 className="text-sm font-medium text-red-700 mb-2">Error information:</h4>
                <pre className="text-xs bg-white p-2 rounded text-red-600">
                  {error}
                </pre>
              </div>
            )}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Component state:</h4>
              <pre className="text-xs bg-white p-2 rounded">
                {JSON.stringify({
                  keywords: keywords,
                  loading: loading,
                  error: error,
                  hasImage: !!selectedImage,
                  previewUrl: previewUrl ? 'Set' : 'Not set',
                  lastUpdate: new Date().toISOString()
                }, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 