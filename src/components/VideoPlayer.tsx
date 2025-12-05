'use client';

/**
 * VideoPlayer Component
 * Orchestrates video playback using specialized hooks for different formats.
 */

import { useEffect, useRef, useState } from 'react';
import { StreamFormat } from '@/types/video-player.types';
import { detectStreamFormat } from '@/lib/video-utils';
import { isMKVFile } from '@/lib/mkv-handler';

// Hooks
import { useProxyUrl } from '@/hooks/useProxyUrl';
import { usePlayerError } from '@/hooks/usePlayerError';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useMkvConversion } from '@/hooks/useMkvConversion';
import { useHlsPlayer } from '@/hooks/useHlsPlayer';
import { useDashPlayer } from '@/hooks/useDashPlayer';
import { useMpegtsPlayer } from '@/hooks/useMpegtsPlayer';
import { useNativePlayer } from '@/hooks/useNativePlayer';

// Components
import { PlayerCore } from './video-player/PlayerCore';
import { PlayerControls } from './video-player/PlayerControls';
import { PlayerOverlay } from './video-player/PlayerOverlay';

// Utils
import { logger } from '@/lib/video-player/player-logger';

export interface VideoPlayerProps {
  src: string | null;
  poster?: string;
  autoPlay?: boolean;
  userAgent?: string;
  cookies?: string;
  token?: string;
}

export default function VideoPlayer({
  src,
  poster,
  autoPlay = true,
  userAgent,
  cookies,
  token
}: VideoPlayerProps) {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // State
  const [loading, setLoading] = useState(true);
  const [streamFormat, setStreamFormat] = useState<StreamFormat>(StreamFormat.UNKNOWN);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);

  // Custom hooks
  const { error, handleError, clearError } = usePlayerError();
  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef);
  const { isTransmuxing, transmuxProgress, convertMkv } = useMkvConversion();
  const { finalUrl } = useProxyUrl({
    src,
    format: streamFormat,
    userAgent,
    cookies,
    token
  });

  // Player hooks
  const hlsPlayer = useHlsPlayer({
    autoPlay,
    onError: handleError,
    onLoading: setLoading
  });

  const dashPlayer = useDashPlayer({
    autoPlay,
    onError: handleError,
    onLoading: setLoading
  });

  const mpegtsPlayer = useMpegtsPlayer({
    autoPlay,
    onError: handleError,
    onLoading: setLoading
  });

  const nativePlayer = useNativePlayer({
    autoPlay,
    onError: handleError,
    onLoading: setLoading
  });

  // Volume handlers
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume / 100;
      if (newVolume > 0 && isMuted) {
        setIsMuted(false);
        videoRef.current.muted = false;
      }
    }
  };

  const handleToggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      videoRef.current.muted = newMuted;
    }
  };

  // Initialize player when src changes
  useEffect(() => {
    if (!src || !videoRef.current) return;

    const video = videoRef.current;
    setLoading(true);
    clearError();

    logger.info('Initializing player', { data: { src: src.substring(0, 100) + '...' } });

    // Detect stream format
    const format = detectStreamFormat(src);
    setStreamFormat(format);

    logger.info(`Detected format: ${format}`);

    // Handle MKV conversion
    if (isMKVFile(src)) {
      convertMkv(src)
        .then((mp4Url) => {
          if (mp4Url && videoRef.current) {
            nativePlayer.initialize(videoRef.current, mp4Url);
          }
        })
        .catch((error) => {
          handleError(`Failed to convert MKV: ${error.message}`, 'decode', true);
          setLoading(false);
        });
      return;
    }

    // Get final URL (with or without proxy)
    const url = finalUrl || src;

    // Initialize appropriate player based on format
    const initPlayer = async () => {
      try {
        switch (format) {
          case StreamFormat.HLS:
            hlsPlayer.initialize(video, url);
            break;
          case StreamFormat.DASH:
            await dashPlayer.initialize(video, url);
            break;
          case StreamFormat.MPEGTS:
            mpegtsPlayer.initialize(video, url);
            break;
          case StreamFormat.MP4:
          case StreamFormat.NATIVE:
            nativePlayer.initialize(video, url);
            break;
          default:
            // Default to HLS if unknown, or Native if supported
            logger.warn(`Unknown format: ${format}, trying HLS`);
            hlsPlayer.initialize(video, url);
        }
      } catch (error: any) {
        handleError(`Failed to initialize player: ${error.message}`, 'unknown', true);
        setLoading(false);
      }
    };

    initPlayer();

    // Cleanup on unmount or src change
    return () => {
      logger.debug('Cleaning up players');
      hlsPlayer.cleanup();
      dashPlayer.cleanup();
      mpegtsPlayer.cleanup();
      nativePlayer.cleanup();
    };
  }, [src, finalUrl]);

  if (!src) {
    return (
      <div className="relative w-full h-full bg-black flex items-center justify-center">
        <p className="text-gray-400">No video source provided</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black overflow-hidden"
    >
      {/* Video Element */}
      <PlayerCore ref={videoRef} />

      {/* Overlay (Loading, Error, Poster) */}
      <PlayerOverlay
        loading={loading}
        error={error?.message || null}
        poster={poster}
        isTransmuxing={isTransmuxing}
        transmuxProgress={transmuxProgress}
      />

      {/* Controls */}
      {!loading && !error && (
        <PlayerControls
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          volume={volume}
          isMuted={isMuted}
          onVolumeChange={handleVolumeChange}
          onToggleMute={handleToggleMute}
        />
      )}
    </div>
  );
}
