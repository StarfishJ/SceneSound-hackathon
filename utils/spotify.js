const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

export async function getSpotifyToken() {
  try {
    console.log('Getting Spotify access token...');
    console.log('Client ID:', SPOTIFY_CLIENT_ID?.slice(0, 5) + '...');
    console.log('Client Secret:', SPOTIFY_CLIENT_SECRET ? 'Set' : 'Not set');

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to get token:', response.status, errorText);
      throw new Error(`Failed to get Spotify token: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Successfully obtained access token');
    return data.access_token;
  } catch (error) {
    console.error('Error getting Spotify token:', error);
    throw error;
  }
}

export async function searchTracks(accessToken, style, limit = 5) {
  try {
    console.log(`Searching for songs with style "${style}"...`);
    
    const query = encodeURIComponent(`genre:${style}`);
    const url = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=${limit}`;
    
    console.log('Sending request to:', url);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to search songs:', response.status, errorText);
      throw new Error(`Failed to search songs: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.tracks || !data.tracks.items) {
      console.log('No songs found:', data);
      return [];
    }

    const tracks = data.tracks.items.map(track => ({
      id: track.id,
      name: track.name,
      artist: track.artists[0].name,
      albumImage: track.album.images[0]?.url,
      previewUrl: track.preview_url,
      spotifyUrl: track.external_urls.spotify
    }));

    console.log(`Found ${tracks.length} songs`);
    return tracks;
  } catch (error) {
    console.error('Error searching songs:', error);
    throw error;
  }
} 