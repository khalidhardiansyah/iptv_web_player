/**
 * useProxyUrl Hook
 * Manages proxy URL construction for video streams
 */

import { useMemo } from 'react';
import { StreamFormat } from '@/types/video-player.types';
import { getFinalUrl, isStalkerStream } from '@/lib/video-player/player-detector';
import { logger } from '@/lib/video-player/player-logger';

interface UseProxyUrlOptions {
  src: string | null;
  format: StreamFormat;
  useProxy?: boolean;
  userAgent?: string;
  cookies?: string;
  token?: string;
}

export function useProxyUrl({
  src,
  format,
  useProxy,
  userAgent,
  cookies,
  token
}: UseProxyUrlOptions) {
  const finalUrl = useMemo(() => {
    if (!src) return null;

    const url = getFinalUrl(src, format, useProxy, userAgent, cookies, token);
    const shouldProxy = url !== src;
    const isStalker = isStalkerStream(src);

    logger.debug('URL Configuration', {
      data: {
        original: src.substring(0, 100) + '...',
        final: url.substring(0, 100) + '...',
        shouldProxy,
        isStalker,
        format
      }
    });

    return url;
  }, [src, format, useProxy, userAgent, cookies, token]);

  return {
    finalUrl,
    isStalkerStream: src ? isStalkerStream(src) : false
  };
}
