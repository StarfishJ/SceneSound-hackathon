import { IncomingForm } from 'formidable';
import { analyzeImage } from '../../utils/imageAnalysis';
import { getLocalMusicRecommendations } from '../../utils/localMusic';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Keyword to scene mapping
const KEYWORD_MAPPINGS = {
  // Natural scenes
  nature: ['nature', 'forest', 'mountain', 'garden', 'tree', 'flower', 'grass', 'park'],
  beach: ['beach', 'ocean', 'sea', 'wave', 'sand', 'sunset', 'coast', 'tropical'],
  city: ['city', 'urban', 'street', 'building', 'downtown', 'traffic', 'modern'],
  night: ['night', 'dark', 'star', 'moon', 'evening', 'midnight'],
  
  // Emotions/Atmosphere
  party: ['party', 'dance', 'celebration', 'fun', 'festival', 'club'],
  calm: ['calm', 'peaceful', 'quiet', 'relax', 'meditation', 'zen'],
  energetic: ['energetic', 'active', 'workout', 'exercise', 'running', 'gym'],
  romantic: ['romantic', 'love', 'date', 'couple', 'wedding'],
  melancholic: ['sad', 'rain', 'lonely', 'melancholy', 'nostalgic'],
  epic: ['epic', 'grand', 'dramatic', 'powerful', 'intense']
};

// Scene to music style mapping
const STYLE_MAPPINGS = {
  nature: ['ambient', 'acoustic', 'folk'],
  beach: ['tropical house', 'reggae', 'chill'],
  city: ['electronic', 'pop', 'hip-hop'],
  night: ['deep house', 'jazz', 'lofi'],
  party: ['dance', 'pop', 'electronic'],
  calm: ['classical', 'ambient', 'piano'],
  energetic: ['rock', 'electronic', 'pop'],
  romantic: ['r&b', 'soul', 'jazz'],
  melancholic: ['indie', 'alternative', 'acoustic'],
  epic: ['orchestral', 'cinematic', 'rock'],
  harbor: ['ambient', 'folk', 'acoustic'],
  pier: ['acoustic', 'indie', 'folk'],
  coast: ['tropical house', 'reggae', 'chill'],
  ocean: ['ambient', 'classical', 'new age'],
  boat_deck: ['folk', 'acoustic', 'indie'],
  general: ['pop', 'rock', 'electronic']
};

function analyzeText(text) {
  if (!text || typeof text !== 'string') {
    console.log('Invalid text input:', text);
    return [{
      scene: 'general',
      probability: 0.8
    }];
  }

  const scenes = new Set();
  const textLower = text.toLowerCase().trim();
  const words = textLower.split(/[\s,.!?]+/); // Better word segmentation
  console.log('Analyzing words:', words);

  // Iterate through each keyword mapping
  Object.entries(KEYWORD_MAPPINGS).forEach(([scene, keywords]) => {
    // Check each keyword
    keywords.forEach(keyword => {
      if (words.some(word => word.includes(keyword) || keyword.includes(word))) {
        scenes.add({
          scene: scene,
          probability: 0.9
        });
      }
    });
  });

  // If no scene is found, return default scene
  if (scenes.size === 0) {
    scenes.add({
      scene: 'general',
      probability: 0.8
    });
  }

  const result = Array.from(scenes);
  console.log('Text analysis result:', result);
  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    console.log('Starting request processing...');
    const form = new IncomingForm();
    form.multiples = true;
    
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve({ fields, files });
      });
    });

    const imageFile = files.image?.[0] || files.image;
    const textInput = Array.isArray(fields.text) ? fields.text[0] : fields.text;

    console.log('Received data:', {
      hasImage: !!imageFile,
      imageFileName: imageFile?.originalFilename || 'None',
      textInput: textInput || 'None'
    });

    if (!imageFile && !textInput) {
      return res.status(400).json({ success: false, error: 'Please provide an image or text description' });
    }

    // Analyze image and text
    let scenes = [];
    
    // Analyze image
    if (imageFile) {
      console.log('Analyzing image:', imageFile.originalFilename);
      const imageScenes = await analyzeImage(imageFile);
      console.log('Image analysis result:', imageScenes);
      scenes.push(...imageScenes);
    }

    // Analyze text
    if (textInput) {
      console.log('Analyzing text input:', textInput);
      const textScenes = analyzeText(textInput);
      console.log('Text analysis result:', textScenes);
      scenes.push(...textScenes);
    }

    // Remove duplicate scenes
    scenes = Array.from(new Set(scenes.map(JSON.stringify))).map(JSON.parse);
    console.log('Merged scenes:', scenes);

    // If no scene is recognized, use default scene
    if (scenes.length === 0) {
      console.log('Using default scene');
      scenes.push({
        scene: 'general',
        probability: 0.8
      });
    }

    // Get music style
    const styles = new Set();
    scenes.forEach(scene => {
      const sceneKey = scene.scene.toLowerCase().replace(/\s+/g, '_');
      const mappedStyles = STYLE_MAPPINGS[sceneKey] || STYLE_MAPPINGS.general;
      mappedStyles.forEach(style => styles.add(style));
    });

    const uniqueStyles = Array.from(styles);
    console.log('Selected music style:', uniqueStyles);

    // Get local music recommendations
    console.log('Starting to get local music recommendations...');
    const playlist = await getLocalMusicRecommendations(uniqueStyles);
    console.log(`Found ${playlist.length} recommended songs:`, playlist);

    const response = {
      success: true,
      data: {
        scenes: scenes.map(scene => ({
          ...scene,
          source: 'image'
        })),
        styles: uniqueStyles,
        playlist
      }
    };

    console.log('Complete response data:', response);
    return res.status(200).json(response);

  } catch (error) {
    console.error('Error processing request:', error);
    console.error(error.stack);
    return res.status(500).json({
      success: false,
      error: error.message || 'Analysis failed'
    });
  }
} 