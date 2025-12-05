/**
 * useMpegtsPlayer Hook
 * Manages MPEGTS player initialization with stall detection and auto-recovery
 */

import { useRef, useCallback } from 'react';
import { getDeviceCapabilities } from '@/lib/video-utils';
import { logger } from '@/lib/video-player/player-logger';
import { PlayerErrorType } from './usePlayerError';

interface UseMpegtsPlayerOptions {
  autoPlay?: boolean;
  onError: (message: string, type: PlayerErrorType, fatal?: boolean) => void;
  onLoading: (loading: boolean) => void;
}

export function useMpegtsPlayer({ autoPlay, onError, onLoading }: UseMpegtsPlayerOptions) {
  const mpegtsPlayerRef = useRef<any>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const initialize = useCallback(async (video: HTMLVideoElement, url: string) => {
    try {
      logger.playerInit('MPEGTS', url);

      // Dynamically import mpegts.js
      const mpegts = (await import('mpegts.js')).default;

      if (!mpegts.isSupported()) {
        onError('MPEG-TS is not supported in this browser', 'source');
        onLoading(false);
        return;
      }

      const capabilities = getDeviceCapabilities();

      const playerConfig = {
        type: 'mpegts',
        url,
        isLive: true,
        cors: true,
      };

      const config = {
        enableWorker: !capabilities.isLowEnd,
        lazyLoadMaxDuration: 3 * 60,
        seekType: 'range' as 'range',
        // Optimized for stable playback with larger buffers
        liveBufferLatencyChasing: false, // Disable aggressive latency chasing
        liveBufferLatencyMaxLatency: 5, // Increased from 1.5 to 5 seconds
        liveBufferLatencyMinRemain: 1, // Increased from 0.3 to 1 second
        stashInitialSize: 1024, // Increased from 384KB to 1MB for better buffering
        enableStashBuffer: true,
        autoCleanupSourceBuffer: true,
        autoCleanupMaxBackwardDuration: 30, // Increased from 10 to 30 seconds
        autoCleanupMinBackwardDuration: 10, // Increased from 5 to 10 seconds
      };

      logger.debug('Creating MPEGTS player', { prefix: 'MPEGTS', data: { playerConfig, config } });

      const player = mpegts.createPlayer(playerConfig, config);
      mpegtsPlayerRef.current = player;
      player.attachMediaElement(video);

      logger.playerSuccess('MPEGTS', 'Player attached to video element');

      player.load();

      if (autoPlay) {
        // Wait for video to be ready before attempting autoplay
        const attemptAutoplay = () => {
          if (video.readyState >= 2) { // HAVE_CURRENT_DATA or better
            const playPromise = player.play();
            if (playPromise !== undefined) {
              (playPromise as Promise<void>)
                .then(() => logger.playerSuccess('MPEGTS', 'Playback started'))
                .catch((e: any) => {
                  if (e.name === 'AbortError') return;
                  logger.warn('Autoplay blocked, trying muted', { prefix: 'MPEGTS' });
                  video.muted = true;
                  (player.play() as Promise<void>).catch((e2: any) => {
                    if (e2.name !== 'AbortError') {
                      logger.error('Muted autoplay also blocked', { prefix: 'MPEGTS', data: e2 });
                    }
                  });
                });
            }
          } else {
            // Wait for loadedmetadata event
            const handleLoadedMetadata = () => {
              video.removeEventListener('loadedmetadata', handleLoadedMetadata);
              const playPromise = player.play();
              if (playPromise !== undefined) {
                (playPromise as Promise<void>)
                  .then(() => logger.playerSuccess('MPEGTS', 'Playback started'))
                  .catch((e: any) => {
                    if (e.name === 'AbortError') return;
                    logger.warn('Autoplay blocked, trying muted', { prefix: 'MPEGTS' });
                    video.muted = true;
                    (player.play() as Promise<void>).catch((e2: any) => {
                      if (e2.name !== 'AbortError') {
                        logger.error('Muted autoplay also blocked', { prefix: 'MPEGTS', data: e2 });
                      }
                    });
                  });
              }
            };
            video.addEventListener('loadedmetadata', handleLoadedMetadata);
          }
        };

        // Small delay to ensure MediaSource is attached
        setTimeout(attemptAutoplay, 100);
      }

      // Error handling
      player.on(mpegts.Events.ERROR, (type: any, details: any, data: any) => {
        logger.playerError('MPEGTS', `Error: ${details}`, { type, data });
        
        if (type === mpegts.ErrorTypes.NETWORK_ERROR) {
          if (data?.code === 503) {
            onError('Stream unavailable (503). The channel server is temporarily down.', 'network', true);
          } else {
            onError('Network error', 'network', true);
          }
        } else {
          onError(`MPEGTS error: ${details}`, 'decode', true);
        }
      });

      player.on(mpegts.Events.LOADING_COMPLETE, () => {
        logger.playerEvent('MPEGTS', 'LOADING_COMPLETE');
        onLoading(false);
      });

      player.on(mpegts.Events.MEDIA_INFO, (mediaInfo: any) => {
        logger.playerEvent('MPEGTS', 'MEDIA_INFO', mediaInfo);
      });

      // Add video element event listeners for more reliable loading state
      const handleCanPlay = () => {
        logger.playerEvent('MPEGTS', 'canplay');
        onLoading(false);
      };

      const handlePlaying = () => {
        logger.playerEvent('MPEGTS', 'playing');
        onLoading(false);
      };

      const handleLoadedData = () => {
        logger.playerEvent('MPEGTS', 'loadeddata');
        onLoading(false);
      };

      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('playing', handlePlaying);
      video.addEventListener('loadeddata', handleLoadedData);

      // Store cleanup function for video listeners
      const videoCleanup = () => {
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('playing', handlePlaying);
        video.removeEventListener('loadeddata', handleLoadedData);
      };

      // Stall detection and auto-recovery
      let lastCurrentTime = 0;
      let stallCount = 0;
      const maxStallCount = 5; // Increased from 3 to 5 seconds before recovery

      const stallInterval = setInterval(() => {
        if (!video || !mpegtsPlayerRef.current) return;

        if (!video.paused && !video.ended && video.readyState >= 2) {
          if (video.currentTime === lastCurrentTime && video.currentTime > 0) {
            stallCount++;
            logger.stallDetected('MPEGTS', video.currentTime, stallCount);

            if (stallCount >= maxStallCount) {
              logger.recoveryAttempt('MPEGTS');
              try {
                mpegtsPlayerRef.current.unload();
                mpegtsPlayerRef.current.load();
                mpegtsPlayerRef.current.play();
                stallCount = 0;
              } catch (e) {
                logger.error('Recovery failed', { prefix: 'MPEGTS', data: e });
              }
            }
          } else {
            if (stallCount > 0) {
              logger.playerSuccess('MPEGTS', 'Playback resumed');
            }
            stallCount = 0;
            lastCurrentTime = video.currentTime;
          }
        } else {
          stallCount = 0;
          lastCurrentTime = video.currentTime;
        }

        // Handle unexpected 'ended' state for live streams
        if (video.ended && !video.paused) {
          logger.warn('Live stream ended unexpectedly, recovering', { prefix: 'MPEGTS' });
          try {
            mpegtsPlayerRef.current.unload();
            mpegtsPlayerRef.current.load();
            mpegtsPlayerRef.current.play();
          } catch (e) {
            logger.error('Recovery from ended state failed', { prefix: 'MPEGTS', data: e });
          }
        }
      }, 1000);

      cleanupRef.current = () => {
        clearInterval(stallInterval);
        videoCleanup();
      };
    } catch (error) {
      logger.playerError('MPEGTS', 'Failed to initialize', error);
      onError('Failed to initialize MPEG-TS player', 'unknown', true);
    }
  }, [autoPlay, onError, onLoading]);

  const cleanup = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (mpegtsPlayerRef.current) {
      logger.debug('Cleaning up MPEGTS player', { prefix: 'MPEGTS' });
      try {
        mpegtsPlayerRef.current.pause();
        mpegtsPlayerRef.current.unload();
        mpegtsPlayerRef.current.detachMediaElement();
        mpegtsPlayerRef.current.destroy();
      } catch (e) {
        logger.warn('Error during cleanup', { prefix: 'MPEGTS', data: e });
      }
      mpegtsPlayerRef.current = null;
    }
  }, []);

  return {
    initialize,
    cleanup,
    mpegtsInstance: mpegtsPlayerRef.current
  };
}
