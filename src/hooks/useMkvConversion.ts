/**
 * useMkvConversion Hook
 * Handles MKV file detection and conversion to MP4
 */

import { useState, useCallback } from 'react';
import { convertMKVToMP4, isMKVFile, supportsWebCodecs } from '@/lib/mkv-handler';
import { logger } from '@/lib/video-player/player-logger';

export function useMkvConversion() {
  const [isTransmuxing, setIsTransmuxing] = useState(false);
  const [transmuxProgress, setTransmuxProgress] = useState(0);

  const convertMkv = useCallback(async (src: string): Promise<string | null> => {
    if (!isMKVFile(src)) {
      return null; // Not an MKV file
    }

    // Check browser support
    if (!supportsWebCodecs()) {
      throw new Error(
        'MKV files require a modern browser (Chrome 94+, Edge 94+, or Safari 16.4+)'
      );
    }

    try {
      setIsTransmuxing(true);
      setTransmuxProgress(0);

      logger.info('Starting MKV conversion', { emoji: '🔄' });

      const mp4Url = await convertMKVToMP4(src, (progress, message) => {
        setTransmuxProgress(progress);
        logger.debug(`Conversion progress: ${progress}%`, { data: message });
      });

      logger.playerSuccess('MKV', 'Conversion completed successfully');
      setIsTransmuxing(false);
      
      return mp4Url;
    } catch (error: any) {
      logger.playerError('MKV', 'Conversion failed', error);
      setIsTransmuxing(false);
      throw error;
    }
  }, []);

  return {
    isTransmuxing,
    transmuxProgress,
    convertMkv
  };
}
