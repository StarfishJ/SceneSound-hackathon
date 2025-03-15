import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

export default function UploadSection({ onUpload, isLoading }) {
  const [textInput, setTextInput] = useState('');

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const formData = new FormData();
      formData.append('image', file);
      formData.append('text', textInput);
      
      try {
        onUpload(formData);
      } catch (error) {
        console.error('File upload error:', error);
      }
    }
  }, [onUpload, textInput]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif']
    },
    maxFiles: 1,
    disabled: isLoading
  });

  return (
    <div className="max-w-2xl mx-auto mb-12 space-y-6">
      <div className="w-full">
        <label htmlFor="text-input" className="block text-sm font-medium text-gray-700 mb-2">
          Describe the music style or mood you want (optional)
        </label>
        <input
          id="text-input"
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="For example: Easy jazz, Happy pop music..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
        />
      </div>

      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          <div className="text-4xl text-gray-400">
            📷
          </div>
          {isLoading ? (
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <p>Analyzing image...</p>
            </div>
          ) : isDragActive ? (
            <p className="text-sm text-gray-500">Release to upload</p>
          ) : (
            <div className="text-gray-500">
              Drop your image here, or click to select
              <p className="text-sm text-gray-500">
                Support JPG, PNG, GIF format, up to 5MB
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="w-full">
        <label htmlFor="text-input" className="block text-sm font-medium text-gray-700 mb-2">
          Or enter text to describe a scene
        </label>
        <input
          id="text-input"
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="For example: Easy jazz, Happy pop music..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
        />
      </div>
    </div>
  );
} 