import { Configuration, OpenAIApi } from 'openai';
import { getSpotifyToken, searchTracks } from '../../utils/spotify';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, error: 'No text provided' });
    }

    // Mock scene analysis results
    const scenes = [
      { scene: text, probability: 0.95 }
    ];

    // Recommend music styles based on scenes
    const styles = ['chill', 'ambient', 'relaxing'];

    // Get Spotify access token
    const accessToken = await getSpotifyToken();

    // Get recommended songs
    const playlist = [];
    for (const style of styles) {
      const tracks = await searchTracks(accessToken, style);
      playlist.push(...tracks);
    }

    // Return analysis results
    return res.status(200).json({
      success: true,
      data: {
        scenes,
        styles,
        playlist: playlist.slice(0, 12) // Limit to 12 songs
      }
    });

  } catch (error) {
    console.error('Text analysis error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to analyze text'
    });
  }
} 