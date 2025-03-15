import { useState, useEffect } from 'react';
import styles from '../styles/PolygonShape.module.css';

export default function PolygonShape({ scene, probability }) {
  const [points, setPoints] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // 生成随机多边形点
    const generatePoints = () => {
      const numPoints = 8;
      const radius = 100;
      const center = { x: 100, y: 100 };
      
      return Array.from({ length: numPoints }, (_, i) => {
        const angle = (i / numPoints) * Math.PI * 2;
        const variance = Math.random() * 20 - 10;
        return {
          x: center.x + (radius + variance) * Math.cos(angle),
          y: center.y + (radius + variance) * Math.sin(angle)
        };
      });
    };

    setPoints(generatePoints());
  }, [scene]);

  const handleMouseEnter = () => {
    setIsAnimating(true);
  };

  const handleMouseLeave = () => {
    setIsAnimating(false);
  };

  const pointsString = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div 
      className={styles.container}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <svg viewBox="0 0 200 200" className={styles.svg}>
        <polygon 
          points={pointsString}
          className={`${styles.polygon} ${isAnimating ? styles.animate : ''}`}
        />
      </svg>
      <div className={styles.label}>
        <h3>{scene}</h3>
        <p>{Math.round(probability * 100)}%</p>
      </div>
    </div>
  );
} 