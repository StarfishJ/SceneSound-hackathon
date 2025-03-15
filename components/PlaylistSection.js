import { useState, useRef } from 'react';
import styles from '../styles/PlaylistSection.module.css';

export default function PlaylistSection({ playlist }) {
  const [playingTrack, setPlayingTrack] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const audioRef = useRef(null);

  const handlePlay = async (track) => {
    try {
      setPreviewError(null);
      if (playingTrack?.name === track.name) {
        audioRef.current?.pause();
        setPlayingTrack(null);
      } else {
        if (audioRef.current) {
          audioRef.current.pause();
        }

        if (!track.previewUrl) {
          setPreviewError(track.name);
          console.log('This song does not have a preview audio');
          return;
        }

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

  return (
    <div className={`${styles.container} ${styles.audioPlayer}`}>
      {playlist.map((track, index) => (
        track && track.name && (
          <div key={index} className={styles.trackItem}>
            <img 
              src={track.albumImageUrl || '/default-album.png'} 
              alt={`${track.name} album cover`}
              className={styles.albumCover}
              onError={(e) => {
                console.log('专辑封面加载失败:', track.name, track.albumImageUrl);
                e.target.src = '/default-album.png';
                e.target.onerror = null;
              }}
            />
            <div className={styles.trackInfo}>
              <div className={styles.trackNumber}>{index + 1}</div>
              <div className={styles.trackDetails}>
                <h3>{track.name}</h3>
                <p>{track.artist}</p>
                {track.albumName && (
                  <p className={styles.albumName}>{track.albumName}</p>
                )}
              </div>
              <div className={styles.trackControls}>
                <button 
                  className={styles.playButton}
                  onClick={() => handlePlay(track)}
                >
                  {playingTrack?.name === track.name ? '❚❚' : '▶'}
                </button>
                {track.spotifyUrl && (
                  <a
                    href={track.spotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.spotifyLink}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg className={styles.spotifyIcon} viewBox="0 0 24 24">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                  </a>
                )}
              </div>
            </div>
            {previewError === track.name && (
              <p className={styles.previewError}>预览不可用</p>
            )}
          </div>
        )
      ))}
    </div>
  );
}