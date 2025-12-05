/**
 * useHlsPlayer Hook
 * Manages HLS player initialization and lifecycle
 */

import { useRef, useCallback } from 'react';
import Hls from 'hls.js';
import { getOptimalHlsConfig, supportsNativeHLS, getDeviceCapabilities } from '@/lib/video-utils';
import { logger } from '@/lib/video-player/player-logger';
import { PlayerErrorType } from './usePlayerError';

interface UseHlsPlayerOptions {
  autoPlay?: boolean;
  onError: (message: string, type: PlayerErrorType, fatal?: boolean) => void;
  onLoading: (loading: boolean) => void;
}

export function useHlsPlayer({ autoPlay, onError, onLoading }: UseHlsPlayerOptions) {
  const hlsRef = useRef<Hls | null>(null);

  const initialize = useCallback((video: HTMLVideoElement, url: string) => {
    const capabilities = getDeviceCapabilities();

    logger.playerInit('HLS', url);

    // Use native HLS on mobile Safari
    if (supportsNativeHLS() && capabilities.isMobile) {
      logger.info('Using native HLS support', { prefix: 'HLS' });
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        onLoading(false);
        logger.playerSuccess('HLS', 'Native HLS loaded');
      });
      return;
    }

    // Use HLS.js
    if (!Hls.isSupported()) {
      onError('HLS is not supported in this browser', 'source');
      onLoading(false);
      return;
    }

    const config = getOptimalHlsConfig(capabilities);
    const hls = new Hls(config);
    hlsRef.current = hls;

    hls.loadSource(url);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      onLoading(false);
      logger.playerSuccess('HLS', 'Manifest parsed');

      if (autoPlay) {
        video.play().catch((e) => {
          logger.warn('Autoplay blocked, trying muted', { prefix: 'HLS' });
          video.muted = true;
          video.play().catch(() => logger.error('Muted autoplay also blocked', { prefix: 'HLS' }));
        });
      }
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      logger.playerError('HLS', `Error: ${data.details}`, data);

      const isDemuxerError = 
        data.details === 'fragParsingError' ||
        (data.error?.message?.includes('DEMUXER_ERROR_COULD_NOT_OPEN'));

      if (data.fatal || isDemuxerError) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            logger.warn('Network error, attempting recovery', { prefix: 'HLS' });
            onError('Network error. Retrying...', 'network', true);
            hls.startLoad();
            break;

          case Hls.ErrorTypes.MEDIA_ERROR:
            if (isDemuxerError) {
              logger.error('Demuxer error, destroying player', { prefix: 'HLS' });
              hls.destroy();
              onError('Stream format error. Retrying with proxy...', 'decode', true);
            } else {
              logger.warn('Media error, attempting recovery', { prefix: 'HLS' });
              hls.recoverMediaError();
            }
            break;

          default:
            logger.error('Unrecoverable error', { prefix: 'HLS', data });
            hls.destroy();
            onError(`Stream error: ${data.details}`, 'unknown', true);
            break;
        }
      }
    });

    // Add video element event listeners for more reliable loading state
    const handleCanPlay = () => {
      logger.playerEvent('HLS', 'canplay');
      onLoading(false);
    };

    const handlePlaying = () => {
      logger.playerEvent('HLS', 'playing');
      onLoading(false);
    };

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('playing', handlePlaying);
  }, [autoPlay, onError, onLoading]);

  const cleanup = useCallback(() => {
    if (hlsRef.current) {
      logger.debug('Cleaning up HLS player', { prefix: 'HLS' });
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  return {
    initialize,
    cleanup,
    hlsInstance: hlsRef.current
  };
}
