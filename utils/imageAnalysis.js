import { promises as fs } from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';

// Use local service
const PYTHON_SERVICE_URL = 'http://localhost:5000/analyze';

// Predefined scene keyword mapping
const SCENE_KEYWORDS = {
  nature: ['nature', 'forest', 'mountain', 'garden', 'tree', 'flower', 'grass', 'park', 'green', 'natural'],
  beach: ['beach', 'ocean', 'sea', 'wave', 'sand', 'sunset', 'coast', 'tropical', 'water', 'shore'],
  city: ['city', 'urban', 'street', 'building', 'downtown', 'traffic', 'modern', 'architecture', 'town'],
  night: ['night', 'dark', 'star', 'moon', 'evening', 'midnight', 'light', 'dusk'],
  party: ['party', 'dance', 'celebration', 'fun', 'festival', 'club', 'concert', 'disco'],
  calm: ['calm', 'peaceful', 'quiet', 'relax', 'meditation', 'zen', 'serenity', 'tranquil'],
  energetic: ['energetic', 'active', 'workout', 'exercise', 'running', 'gym', 'sport', 'dynamic'],
  romantic: ['romantic', 'love', 'date', 'couple', 'wedding', 'heart', 'rose', 'romance'],
  melancholic: ['sad', 'rain', 'lonely', 'melancholy', 'nostalgic', 'autumn', 'winter', 'grey'],
  epic: ['epic', 'grand', 'dramatic', 'powerful', 'intense', 'storm', 'majestic', 'vast']
};

export async function analyzeImage(file) {
  try {
    if (!file || !file.filepath) {
      console.log('Invalid file object:', file);
      return [{
        scene: 'general',
        probability: 0.8
      }];
    }

    console.log('Analyzing image:', file.filepath);

    // Create FormData object
    const formData = new FormData();
    const imageStream = await fs.readFile(file.filepath);
    formData.append('image', imageStream, {
      filename: file.originalFilename,
      contentType: file.mimetype
    });

    // Call Python service
    const response = await fetch(PYTHON_SERVICE_URL, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    
    if (!result.success) {
      console.error('Python service returned error:', result.error);
      return [{
        scene: 'general',
        probability: 0.8
      }];
    }

    console.log('Scene analysis results:', result.scenes);
    return result.scenes;

  } catch (error) {
    console.error('Error analyzing image:', error);
    return [{
      scene: 'general',
      probability: 0.8
    }];
  }
} 