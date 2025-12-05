/**
 * useNativePlayer Hook
 * Manages native HTML5 video playback
 */

import { useCallback } from 'react';
import { logger } from '@/lib/video-player/player-logger';
import { PlayerErrorType } from './usePlayerError';

interface UseNativePlayerOptions {
  autoPlay?: boolean;
  onError: (message: string, type: PlayerErrorType, fatal?: boolean) => void;
  onLoading: (loading: boolean) => void;
}

export function useNativePlayer({ autoPlay, onError, onLoading }: UseNativePlayerOptions) {
  const initialize = useCallback((video: HTMLVideoElement, url: string) => {
    logger.playerInit('Native', url);

    video.src = url;

    const handleLoadedMetadata = () => {
      logger.playerSuccess('Native', 'Metadata loaded');
      onLoading(false);

      if (autoPlay) {
        video.play().catch((e) => {
          logger.warn('Autoplay blocked, trying muted', { prefix: 'Native' });
          video.muted = true;
          video.play().catch(() => logger.error('Muted autoplay also blocked', { prefix: 'Native' }));
        });
      }
    };

    const handleError = (e: Event) => {
      const videoElement = e.target as HTMLVideoElement;
      const error = videoElement.error;

      if (error) {
        logger.playerError('Native', `Error code: ${error.code}`, error);
        
        let message = 'Video playback error';
        let type: PlayerErrorType = 'unknown';

        switch (error.code) {
          case MediaError.MEDIA_ERR_NETWORK:
            message = 'Network error while loading video';
            type = 'network';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            message = 'Video decoding error';
            type = 'decode';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            message = 'Video format not supported';
            type = 'source';
            break;
        }

        onError(message, type, true);
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('error', handleError);
    };
  }, [autoPlay, onError, onLoading]);

  const cleanup = useCallback(() => {
    logger.debug('Cleaning up Native player', { prefix: 'Native' });
  }, []);

  return {
    initialize,
    cleanup
  };
}
