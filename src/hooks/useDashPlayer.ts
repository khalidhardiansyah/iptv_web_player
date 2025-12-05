/**
 * useDashPlayer Hook
 * Manages DASH player initialization (using dashjs)
 */

import { useRef, useCallback } from 'react';
import { getOptimalDashConfig, getDeviceCapabilities } from '@/lib/video-utils';
import { logger } from '@/lib/video-player/player-logger';
import { PlayerErrorType } from './usePlayerError';

interface UseDashPlayerOptions {
  autoPlay?: boolean;
  onError: (message: string, type: PlayerErrorType, fatal?: boolean) => void;
  onLoading: (loading: boolean) => void;
}

export function useDashPlayer({ autoPlay, onError, onLoading }: UseDashPlayerOptions) {
  const dashPlayerRef = useRef<any>(null);

  const initialize = useCallback(async (video: HTMLVideoElement, url: string) => {
    try {
      logger.playerInit('DASH', url);

      // Dynamically import dashjs
      const dashjs = (await import('dashjs')).default;
      const capabilities = getDeviceCapabilities();

      const config = getOptimalDashConfig(capabilities);
      const player = dashjs.MediaPlayer().create();
      dashPlayerRef.current = player;

      player.updateSettings(config);
      player.initialize(video, url, autoPlay);

      logger.playerSuccess('DASH', 'Player initialized');

      player.on('error', (e: any) => {
        logger.playerError('DASH', `Error: ${e.error}`, e);
        onError(`DASH error: ${e.error}`, 'decode', true);
      });

      player.on('canPlay', () => {
        logger.playerEvent('DASH', 'canPlay');
        onLoading(false);
      });

      player.on('playbackStarted', () => {
        logger.playerSuccess('DASH', 'Playback started');
      });

    } catch (error) {
      logger.playerError('DASH', 'Failed to initialize', error);
      onError('Failed to initialize DASH player', 'unknown', true);
    }
  }, [autoPlay, onError, onLoading]);

  const cleanup = useCallback(() => {
    if (dashPlayerRef.current) {
      logger.debug('Cleaning up DASH player', { prefix: 'DASH' });
      try {
        dashPlayerRef.current.reset();
      } catch (e) {
        logger.warn('Error during cleanup', { prefix: 'DASH', data: e });
      }
      dashPlayerRef.current = null;
    }
  }, []);

  return {
    initialize,
    cleanup,
    dashInstance: dashPlayerRef.current
  };
}
