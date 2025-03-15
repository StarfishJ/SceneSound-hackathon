// Get track ID from Spotify URI
function getTrackIdFromUri(uri) {
  if (!uri) return null;
  return uri.split(':')[2];
}

// Generate album cover URL from track ID
function getAlbumImageUrl(trackId) {
  if (!trackId) return '/default-album.jpg';
  // Spotify image URL format
  return `https://i.scdn.co/image/${trackId}`;
}

// Get music recommendations from local JSON file
export async function getLocalMusicRecommendations(styles) {
  try {
    // Load music data from local JSON file
    const response = await fetch('/downloads/spotify/tracks.json');
    const tracks = await response.json();
    
    console.log('Obtained music data:', tracks.length, 'songs');
    
    // Filter English songs (using a simple check for non-Chinese characters)
    const englishTracks = tracks.filter(track => 
      !/[\u4e00-\u9fa5]/.test(track.track_name) && 
      !/[\u4e00-\u9fa5]/.test(track.artist_name)
    );
    
    console.log('Filtered English songs:', englishTracks.length);
    
    // Randomize and limit quantity to 6
    const shuffled = englishTracks.sort(() => Math.random() - 0.5);
    const selectedTracks = shuffled.slice(0, 6);
    
    console.log('Selected music:', selectedTracks.length, 'songs');
    
    return selectedTracks.map(track => {
      const trackId = getTrackIdFromUri(track.track_uri);
      return {
        id: track.track_uri || Math.random().toString(36).substr(2, 9),
        name: track.track_name,
        artist: track.artist_name,
        albumName: track.album_name,
        duration: track.duration_ms,
        spotifyUri: track.track_uri,
        artistUri: track.artist_uri,
        albumUri: track.album_uri,
        pos: track.pos,
        albumImageUrl: getAlbumImageUrl(trackId)
      };
    });
  } catch (error) {
    console.error('Failed to obtain local music recommendations:', error);
    console.error(error.stack);
    return [];
  }
} 