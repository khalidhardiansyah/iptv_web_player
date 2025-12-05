/**
 * useFullscreen Hook
 * Manages fullscreen state and toggle functionality
 */

import { useState, useEffect, useCallback, RefObject } from 'react';
import { logger } from '@/lib/video-player/player-logger';

export function useFullscreen(containerRef: RefObject<HTMLDivElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        logger.info('Entered fullscreen mode');
      } else {
        await document.exitFullscreen();
        logger.info('Exited fullscreen mode');
      }
    } catch (error) {
      logger.error('Fullscreen toggle failed', { data: error });
    }
  }, [containerRef]);

  return {
    isFullscreen,
    toggleFullscreen
  };
}
