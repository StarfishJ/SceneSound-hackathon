import { vision } from '@google-cloud/vision';
import SpotifyWebApi from 'spotify-web-api-node';
import multer from 'multer';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { sceneRecognizer } from '../../lib/ml/sceneRecognition';
import * as tf from '@tensorflow/tfjs';
import sharp from 'sharp';
import { SceneRecognizer } from '../../lib/ml/sceneRecognition';
import fetch from 'node-fetch';
import FormData from 'form-data';

// Configure multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Convert multer middleware to Promise
const runMiddleware = (req, res, fn) => {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
};

// Check environment variables and credentials file
const checkCredentials = () => {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  
  if (!credentialsPath) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set');
  }

  // Parse relative path
  const absolutePath = path.resolve(process.cwd(), credentialsPath);
  
  try {
    // Check if credentials file exists
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Google Cloud credentials file not found: ${absolutePath}`);
    }

    // Validate credentials file format
    const credentials = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
    const missingFields = requiredFields.filter(field => !credentials[field]);

    if (missingFields.length > 0) {
      throw new Error(`Credentials file missing required fields: ${missingFields.join(', ')}`);
    }

    // Update environment variable to absolute path
    process.env.GOOGLE_APPLICATION_CREDENTIALS = absolutePath;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Google Cloud credentials file not found: ${absolutePath}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error('Google Cloud credentials file format invalid');
    }
    throw error;
  }

  // Check Spotify credentials
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    throw new Error('Spotify API credentials not set');
  }
};

// Initialize Google Cloud Vision client
let client = null;
const initializeVisionClient = async () => {
  try {
    checkCredentials();
    client = new vision.ImageAnnotatorClient();
    
    // Test client connection
    await client.labelDetection({
      image: { content: Buffer.from('test') }
    }).catch(() => {}); // Ignore test errors
    
    return true;
  } catch (error) {
    console.error('Vision API initialization error:', error);
    return false;
  }
};

// Initialize Spotify API
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});

// Get Spotify access token
async function getSpotifyToken() {
  try {
    console.log('Getting Spotify access token...');
    console.log('Client ID:', process.env.SPOTIFY_CLIENT_ID);
    console.log('Client Secret:', process.env.SPOTIFY_CLIENT_SECRET?.substring(0, 4) + '...');
    
    const data = await spotifyApi.clientCredentialsGrant();
    const token = data.body['access_token'];
    console.log('Successfully got access token');
    spotifyApi.setAccessToken(token);
    return token;
  } catch (error) {
    console.error('Failed to get Spotify token:', error.message);
    if (error.statusCode === 400) {
      console.error('Client credentials invalid, please check SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET');
    }
    throw error;
  }
}

// Search music
async function searchMusic(styles) {
  try {
    // Ensure access token
    await getSpotifyToken();
    
    const tracks = [];
    for (const style of styles) {
      try {
        console.log(`Searching music style: ${style}`);
        const result = await spotifyApi.searchTracks(`genre:${style}`, { 
          limit: 3,
          market: 'US'  // Specify market
        });
        
        if (result.body.tracks.items.length > 0) {
          const mappedTracks = result.body.tracks.items.map(track => ({
            name: track.name,
            artist: track.artists[0].name,
            previewUrl: track.preview_url,
            spotifyUrl: track.external_urls.spotify,
            albumImage: track.album.images[0]?.url
          }));
          console.log(`Found ${mappedTracks.length} songs`);
          tracks.push(...mappedTracks);
        } else {
          console.log(`No music found for ${style} style`);
        }
      } catch (error) {
        console.error(`Search music failed (${style}):`, error.message);
      }
    }
    return tracks;
  } catch (error) {
    console.error('Error searching music:', error.message);
    return [];
  }
}

// Generate music search keywords based on scene and label
const generateMusicKeywords = (scenes, labels) => {
  const keywords = [];

  // Add music styles related to scene
  const sceneToMusic = {
    beach: ['tropical', 'summer', 'waves', 'chill'],
    forest: ['nature', 'ambient', 'peaceful'],
    city: ['urban', 'busy', 'electronic'],
    mountain: ['epic', 'majestic', 'atmospheric'],
    desert: ['mystical', 'world music', 'meditation'],
    park: ['relaxing', 'acoustic', 'peaceful'],
    indoor: ['lounge', 'jazz', 'ambient'],
    restaurant: ['jazz', 'bossa nova', 'dinner']
  };

  // Get keywords from scene prediction
  scenes.forEach(scene => {
    const musicStyles = sceneToMusic[scene.scene] || [];
    keywords.push(...musicStyles.map(style => ({
      term: style,
      weight: scene.probability
    })));
  });

  // Get keywords from labels
  labels.forEach(label => {
    keywords.push({
      term: label.description,
      weight: label.score
    });
  });

  // Sort by weight and return top 5 keywords
  return keywords
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map(k => k.term);
};

// API route handler
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Only POST requests supported'
    });
  }

  try {
    // Handle file upload
    await runMiddleware(req, res, upload.single('image'));

    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded'
      });
    }

    // Send image data to Python service for scene analysis
    const formData = new FormData();
    formData.append('image', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    const pythonResponse = await fetch('http://localhost:8080/analyze', {
      method: 'POST',
      body: formData
    });

    if (!pythonResponse.ok) {
      throw new Error(`Scene analysis service returned error: ${pythonResponse.status}`);
    }

    const sceneAnalysis = await pythonResponse.json();

    if (!sceneAnalysis.success) {
      throw new Error(sceneAnalysis.error || 'Scene analysis failed');
    }

    // Generate music styles based on scenes
    const musicKeywords = generateMusicKeywords(sceneAnalysis.scenes, []);

    // Get music recommendations
    const playlist = await searchMusic(musicKeywords);

    // Return results
    const response = {
      success: true,
      scenes: sceneAnalysis.scenes,
      playlist
    };

    console.log('Response data:', JSON.stringify(response, null, 2));
    return res.status(200).json(response);

  } catch (error) {
    console.error('Error processing request:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Configure API route
export const config = {
  api: {
    bodyParser: false,
  },
}; 