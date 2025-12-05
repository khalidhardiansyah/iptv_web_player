'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
// Import dashjs dynamically to avoid SSR issues
import { AlertCircle, Loader2, Maximize, Minimize, Film } from 'lucide-react';
import {
  StreamFormat,
  PlayerErrorType,
  type PerformanceMetrics,
} from '@/types/video-player.types';
import {
  detectStreamFormat,
  getDeviceCapabilities,
  getOptimalHlsConfig,
  getOptimalDashConfig,
  supportsNativeHLS,
} from '@/lib/video-utils';
import {
  convertMKVToMP4,
  isMKVFile,
  supportsWebCodecs,
} from '@/lib/mkv-handler';




// Type declaration for dashjs and mpegts
type DashPlayerType = any;
type MpegtsPlayerType = any;

interface VideoPlayerProps {
  src: string | null;
  poster?: string;
  autoPlay?: boolean;
  userAgent?: string;
  cookies?: string;
  token?: string;
}

export default function VideoPlayer({ src, poster, autoPlay = true, userAgent, cookies, token }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hlsRef = useRef<Hls | null>(null);
  const dashPlayerRef = useRef<DashPlayerType | null>(null);
  const mpegtsPlayerRef = useRef<MpegtsPlayerType | null>(null);
  const [useProxy, setUseProxy] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    bufferLength: 0,
    droppedFrames: 0,
    currentBitrate: 0,
    currentLevel: 0,
    loadingTime: 0,
    qualitySwitches: 0,
  });

  const retryCountRef = useRef(0);
  const [streamFormat, setStreamFormat] = useState<StreamFormat>(StreamFormat.UNKNOWN);
  const maxRetries = 3;
  const [transmuxProgress, setTransmuxProgress] = useState<number>(0);
  const [isTransmuxing, setIsTransmuxing] = useState(false);


  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Reset state
    setError(null);
    setLoading(!!src);
    setBuffering(false);
    retryCountRef.current = 0;

    // Cleanup previous instances
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (dashPlayerRef.current) {
      dashPlayerRef.current.reset();
      dashPlayerRef.current = null;
    }

    if (mpegtsPlayerRef.current) {
      try {
        const player = mpegtsPlayerRef.current;
        
        // First, set ref to null to prevent any further access
        mpegtsPlayerRef.current = null;
        
        // Try unload first
        try {
          if (player && typeof player.unload === 'function') {
            player.unload();
          }
        } catch (unloadError: any) {
          // Silently ignore unload errors - they're usually harmless during cleanup
          if (!unloadError?.message?.includes('Cannot read properties of null')) {
            console.warn('Error unloading mpegts player:', unloadError);
          }
        }
        
        // Then try destroy
        try {
          if (player && typeof player.destroy === 'function') {
            player.destroy();
          }
        } catch (destroyError: any) {
          // Silently ignore destroy errors during cleanup
          if (!destroyError?.message?.includes('Cannot read properties of null')) {
            console.warn('Error destroying mpegts player:', destroyError);
          }
        }
      } catch (e) {
        // Silently ignore general cleanup errors
      }
    }

    if (!src) {
      setStreamFormat(StreamFormat.UNKNOWN);
      return;
    }

    // Check if this is an MKV file and convert it
    if (isMKVFile(src)) {
      const handleMKVConversion = async () => {
        try {
          // Check if browser supports WebCodecs
          if (!supportsWebCodecs()) {
            setError('MKV files require a modern browser (Chrome 94+, Edge 94+, or Safari 16.4+). Please use the download button below or try a different browser.');
            setLoading(false);
            return;
          }

          setIsTransmuxing(true);
          setLoading(true);
          setError(null);

          // Convert MKV to MP4
          const mp4Url = await convertMKVToMP4(src, (progress, message) => {
            setTransmuxProgress(progress);
            // You could also update a status message here if needed
          });

          // Once converted, update src to the MP4 blob URL
          // This will trigger the useEffect again with the MP4 URL
          setIsTransmuxing(false);
          
          // Use the converted MP4 URL
          // We'll set it as the video source directly
          const video = videoRef.current;
          if (video) {
            video.src = mp4Url;
            if (autoPlay) {
              video.play().catch(e => console.warn('Autoplay failed:', e));
            }
          }
          setLoading(false);
          return; // Exit early, we've handled the MKV

        } catch (error: any) {
          console.error('MKV conversion failed:', error);
          setError(`Failed to convert MKV file: ${error.message}. Please use the download button below.`);
          setIsTransmuxing(false);
          setLoading(false);
          return;
        }
      };

      handleMKVConversion();
      return; // Exit useEffect, conversion will handle playback
    }

    // Detect stream format
    const format = detectStreamFormat(src);
    setStreamFormat(format);

    // Get device capabilities
    const capabilities = getDeviceCapabilities();

    // Determine final URL (with proxy if needed)
    // IMPORTANT: Only encode once to prevent "Failed to parse URL" errors
    // IMPORTANT: mpegts.js worker requires absolute URLs, not relative paths
    // For MPEGTS streams, use proxy from the start to avoid CORS issues
    let finalUrl = src;
    // Stalker streams need proxy for User-Agent spoofing
    const isStalkerStream = src.includes('play_token=') || src.includes('/play/live.php');
    // Xtream streams usually work directly and proxy might cause overhead/issues
    const isXtreamStream = src.includes('.ts') && !isStalkerStream;
    
    // Stalker uses /api/proxy (non-streaming), Xtream uses /api/stream (streaming)
    const shouldUseProxy = useProxy || (format === StreamFormat.MPEGTS && !src.includes('/api/') && !isXtreamStream) || isStalkerStream;
    
    if (shouldUseProxy) {
      const encodedUrl = encodeURIComponent(src);
      let proxyUrl = '';

      // Convert to absolute URL for worker compatibility
      if (typeof window !== 'undefined') {
        // Stalker needs /api/proxy (non-streaming), others use /api/stream (streaming)
        const proxyEndpoint = isStalkerStream ? '/api/proxy' : '/api/stream';
        proxyUrl = `${window.location.origin}${proxyEndpoint}?url=${encodedUrl}`;
      } else {
        const proxyEndpoint = isStalkerStream ? '/api/proxy' : '/api/stream';
        proxyUrl = `${proxyEndpoint}?url=${encodedUrl}`;
      }

      // For Stalker, pass headers via x-* headers (as per /api/proxy implementation)
      if (isStalkerStream) {
        // /api/proxy expects headers as x-user-agent, x-cookie, etc.
        // But mpegts.js can't set custom headers, so we need to append as query params
        // Actually, let's check how GitHub version does it...
        // Looking at GitHub code, they pass headers via x-* headers in fetch request
        // But we're using mpegts.js which makes its own fetch...
        // So we need to append to URL as query params for /api/proxy to pick up
        
        // Wait - /api/proxy expects x-* headers, not query params
        // But mpegts.js will make the request, not us
        // So we need to use /api/stream approach but with different handling
        
        // Actually, let's just use /api/stream for now but with Stalker-specific config
        proxyUrl = `${window.location.origin}/api/stream?url=${encodedUrl}`;
        if (userAgent) proxyUrl += `&ua=${encodeURIComponent(userAgent)}`;
        if (cookies) proxyUrl += `&cookie=${encodeURIComponent(cookies)}`;
        if (token) proxyUrl += `&token=${encodeURIComponent(token)}`;
      } else {
        // Xtream and others use /api/stream
        if (userAgent) proxyUrl += `&ua=${encodeURIComponent(userAgent)}`;
        if (cookies) proxyUrl += `&cookie=${encodeURIComponent(cookies)}`;
        if (token) proxyUrl += `&token=${encodeURIComponent(token)}`;
      }

      finalUrl = proxyUrl;
    }
    
    console.log('[VideoPlayer] Props:', { userAgent, cookies, token });
    console.log('[VideoPlayer] Stream Format:', format);
    console.log('[VideoPlayer] Should Use Proxy:', shouldUseProxy);
    console.log('[VideoPlayer] Is Stalker Stream:', isStalkerStream);
    console.log('[VideoPlayer] Final URL:', finalUrl);




    const handleLoadedData = () => {
      setLoading(false);
      setBuffering(false);
    };

    const handleWaiting = () => {
      setBuffering(true);
    };

    const handlePlaying = () => {
      setBuffering(false);
    };

    const handleError = (e: Event) => {
      const videoElement = e.target as HTMLVideoElement;
      const error = videoElement.error;
      
      let errorMessage = 'Error loading video stream.';
      let errorDetails = '';
      
      if (error) {
        switch (error.code) {
          case error.MEDIA_ERR_ABORTED:
            errorDetails = 'Video playback was aborted';
            break;
          case error.MEDIA_ERR_NETWORK:
            errorDetails = 'Network error while loading video';
            break;
          case error.MEDIA_ERR_DECODE:
            errorDetails = 'Video decoding failed';
            break;
          case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorDetails = 'Video format not supported';
            break;
          default:
            errorDetails = 'Unknown video error';
        }
        
        if (error.message) {
          errorDetails += `: ${error.message}`;
        }
        
        errorMessage = errorDetails;
      }
      
      console.error('Video Error:', {
        event: e,
        error: error,
        code: error?.code,
        message: error?.message,
        src: videoElement.src,
        networkState: videoElement.networkState,
        readyState: videoElement.readyState,
      });
      
      // Special handling for demuxer errors - these are usually server-side issues
      if (errorDetails.includes('DEMUXER_ERROR')) {
        setError('This channel is currently unavailable. The stream may be offline or experiencing issues. Please try another channel.');
        setLoading(false);
        setBuffering(false);
        return; // Don't trigger retry logic for demuxer errors
      }
      
      handlePlaybackError(errorMessage, PlayerErrorType.MEDIA_ERROR);
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('error', handleError);

    // Initialize player based on format
    if (format === StreamFormat.DASH) {
      initializeDashPlayer(video, finalUrl, capabilities);
    } else if (format === StreamFormat.HLS) {
      initializeHlsPlayer(video, finalUrl, capabilities);
    } else if (format === StreamFormat.MPEGTS) {
      initializeMpegtsPlayer(video, finalUrl, capabilities);
    } else if (format === StreamFormat.MP4) {
      // Direct MP4 playback
      video.src = finalUrl;
      if (autoPlay) {

      }
    } else {
      // Try HLS by default for unknown formats
      initializeHlsPlayer(video, finalUrl, capabilities);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      if (dashPlayerRef.current) {
        dashPlayerRef.current.reset();
      }
      if (mpegtsPlayerRef.current) {
        try {
          const player = mpegtsPlayerRef.current;
          mpegtsPlayerRef.current = null;
          
          if (player && typeof player.unload === 'function') {
            player.unload();
          }
          if (player && typeof player.destroy === 'function') {
            player.destroy();
          }
        } catch (e) {
          // Silently ignore cleanup errors
        }
      }
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('error', handleError);
    };
  }, [src, autoPlay, useProxy]);

  const handlePlaybackError = (message: string, type: PlayerErrorType, fatal = true) => {
    console.error(`${type}:`, message);

    if (fatal && retryCountRef.current < maxRetries) {
      retryCountRef.current++;


      // Retry after delay with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 5000);
      
      // If we haven't tried proxy yet and we're retrying, try enabling proxy
      // BUT skip for Xtream streams (.ts without Stalker tokens) as they usually fail with proxy
      const isStalkerStream = src?.includes('play_token=') || src?.includes('/play/live.php');
      const isXtreamStream = src?.includes('.ts') && !isStalkerStream;
      
      if (!useProxy && retryCountRef.current >= 1 && !isXtreamStream) {
        setUseProxy(true);
        return;
      }

      setTimeout(() => {
        if (hlsRef.current) {
          hlsRef.current.startLoad();
        } else if (dashPlayerRef.current && videoRef.current) {
          dashPlayerRef.current.play();
        } else if (mpegtsPlayerRef.current) {
          // Must unload before load to avoid "load() has been called" error
          try {
            mpegtsPlayerRef.current.unload();
          } catch (e) {
            console.warn('Error unloading before retry:', e);
          }
          mpegtsPlayerRef.current.load();
          mpegtsPlayerRef.current.play();
        }
      }, delay);
    } else {
      setError(message);
      setLoading(false);
      setBuffering(false);
    }
  };

  const initializeHlsPlayer = (
    video: HTMLVideoElement,
    url: string,
    capabilities: ReturnType<typeof getDeviceCapabilities>
  ) => {
    // Check for native HLS support (Safari/Mobile)
    // Prefer HLS.js on desktop for better control and error handling
    if (supportsNativeHLS() && capabilities.isMobile) {

      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        setLoading(false);

      });
      return;
    }

    // Use HLS.js
    if (!Hls.isSupported()) {
      setError('HLS is not supported in this browser.');
      setLoading(false);
      return;
    }

    const config = getOptimalHlsConfig(capabilities);
    const hls = new Hls(config);
    hlsRef.current = hls;

    hls.loadSource(url);
    hls.attachMedia(video);

    // Track quality switches
    let qualitySwitchCount = 0;

    hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {

      setLoading(false);

      if (autoPlay) {
        video.play().catch((e) => {
          console.log('Autoplay with sound blocked, trying muted...', e);
          video.muted = true;
          video.play().catch((e2) => console.log('Muted autoplay also blocked', e2));
        });
      }
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
      qualitySwitchCount++;


      setMetrics((prev) => ({
        ...prev,
        currentLevel: data.level,
        qualitySwitches: qualitySwitchCount,
      }));
    });

    hls.on(Hls.Events.FRAG_BUFFERED, (event, data) => {
      const buffered = video.buffered;
      if (buffered.length > 0) {
        const bufferLength = buffered.end(buffered.length - 1) - video.currentTime;
        setMetrics((prev) => ({
          ...prev,
          bufferLength,
        }));
      }
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      console.error('HLS Error:', data);

      // Handle specific non-fatal errors that should be treated as fatal to trigger retry
      // "DEMUXER_ERROR_COULD_NOT_OPEN" often appears in data.details or data.error.message
      // It usually indicates a stream format issue or CORS/Network issue that Hls.js can't recover from easily
      const isDemuxerError = data.details === 'fragParsingError' || 
                             (data.error && data.error.message && data.error.message.includes('DEMUXER_ERROR_COULD_NOT_OPEN'));

      if (data.fatal || isDemuxerError) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.error('Network error, trying to recover...');
            handlePlaybackError(
              'Network error. Retrying...',
              PlayerErrorType.NETWORK_ERROR,
              true
            );
            hls.startLoad();
            break;

          case Hls.ErrorTypes.MEDIA_ERROR:
            if (isDemuxerError) {
               console.error('Demuxer error detected, treating as fatal to trigger proxy retry...');
               hls.destroy();
               handlePlaybackError(
                 'Stream format or access error. Retrying with proxy...',
                 PlayerErrorType.MEDIA_ERROR,
                 true
               );
            } else {
              console.error('Media error, trying to recover...');
              hls.recoverMediaError();
            }
            break;

          default:
            console.error('Unrecoverable error', data);
            hls.destroy();
            handlePlaybackError(
              `Stream error: ${data.details}`,
              PlayerErrorType.UNKNOWN_ERROR,
              true
            );
            break;
        }
      }
    });

    // Monitor performance
    const performanceInterval = setInterval(() => {
      if (video && hls) {
        const quality = hls.levels[hls.currentLevel];

        setMetrics((prev) => ({
          ...prev,
          currentBitrate: quality?.bitrate || 0,
        }));
      }
    }, 5000);

    return () => clearInterval(performanceInterval);
  };

  const initializeDashPlayer = async (
    video: HTMLVideoElement,
    url: string,
    capabilities: ReturnType<typeof getDeviceCapabilities>
  ) => {
    try {
      // Dynamically import dashjs only when needed (client-side only)
      const dashjs = (await import('dashjs')).default;
      
      const config = getOptimalDashConfig(capabilities);
      const player = dashjs.MediaPlayer().create();
      dashPlayerRef.current = player;

      player.initialize(video, url, autoPlay);
      // Apply settings (dashjs has its own config structure)
      if (config.streaming) {
        player.updateSettings(config as any);
      }

      // Track quality switches
      let qualitySwitchCount = 0;

      player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {

        setLoading(false);
      });

      player.on(dashjs.MediaPlayer.events.PLAYBACK_STARTED, () => {

        setBuffering(false);
      });

      player.on(dashjs.MediaPlayer.events.PLAYBACK_WAITING, () => {
        setBuffering(true);
      });

      player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, (e: any) => {
        qualitySwitchCount++;


        setMetrics((prev) => ({
          ...prev,
          currentLevel: e.newQuality,
          qualitySwitches: qualitySwitchCount,
        }));
      });

      player.on(dashjs.MediaPlayer.events.ERROR, (e: any) => {
        console.error('DASH Error:', e);
        handlePlaybackError(
          `DASH error: ${e.error}`,
          PlayerErrorType.UNKNOWN_ERROR,
          true
        );
      });

      // Monitor performance
      const performanceInterval = setInterval(() => {
        if (player) {
          const dashMetrics = player.getDashMetrics();
          const bitrateInfo = player.getBitrateInfoListFor('video');

          if (bitrateInfo && bitrateInfo.length > 0) {
            const currentQuality = player.getQualityFor('video');
            const currentBitrate = bitrateInfo[currentQuality]?.bitrate || 0;

            setMetrics((prev) => ({
              ...prev,
              currentBitrate,
            }));
          }

          // Track dropped frames if available
          const videoElement = player.getVideoElement() as any;
          const droppedFrames = videoElement?.webkitDecodedFrameCount || 0;
          setMetrics((prev) => ({
            ...prev,
            droppedFrames,
          }));
        }
      }, 5000);

      return () => clearInterval(performanceInterval);
    } catch (error) {
      console.error('Failed to load dashjs:', error);
      handlePlaybackError(
        'Failed to initialize DASH player',
        PlayerErrorType.UNKNOWN_ERROR,
        true
      );
    }
  };

  const initializeMpegtsPlayer = async (
    video: HTMLVideoElement,
    url: string,
    capabilities: ReturnType<typeof getDeviceCapabilities>
  ) => {
    try {
      console.log('[MPEGTS] 🎬 Initializing mpegts player...');
      console.log('[MPEGTS] 📺 Stream URL:', url);
      console.log('[MPEGTS] ⚙️ Capabilities:', capabilities);
      
      // Dynamically import mpegts.js
      const mpegts = (await import('mpegts.js')).default;

      if (mpegts.isSupported()) {
        console.log('[MPEGTS] ✅ mpegts.js is supported');
        
        const playerConfig = {
          type: 'mpegts',
          url: url,
          isLive: true,
          cors: true,
        };
        
        const config = {
          enableWorker: !capabilities.isLowEnd,
          lazyLoadMaxDuration: 3 * 60,
          seekType: 'range' as 'range',
          // Optimized for live streaming - reduce buffering/lag
          liveBufferLatencyChasing: true,
          liveBufferLatencyMaxLatency: 1.5, // Reduced from 3 to 1.5 for faster playback
          liveBufferLatencyMinRemain: 0.3, // Reduced from 0.5 to 0.3
          // Increase buffer to prevent stalls
          stashInitialSize: 384, // Increased from default 128KB to 384KB
          // Auto recovery settings
          enableStashBuffer: true,
          autoCleanupSourceBuffer: true,
          autoCleanupMaxBackwardDuration: 10, // Keep only 10s of old data
          autoCleanupMinBackwardDuration: 5,
        };
        
        console.log('[MPEGTS] 🔧 Player config:', playerConfig);
        console.log('[MPEGTS] 🔧 Options:', config);
        
        const player = mpegts.createPlayer(playerConfig, config);
        console.log('[MPEGTS] ✅ Player created');

        mpegtsPlayerRef.current = player;
        player.attachMediaElement(video);
        console.log('[MPEGTS] ✅ Player attached to video element');
        
        // Removed forced mute to allow playing with sound if possible
        // video.muted = true;
        
        console.log('[MPEGTS] 📥 Calling load()...');
        player.load();

        if (autoPlay) {
          console.log('[MPEGTS] ▶️ Calling play()...');
          const playPromise = player.play();
          if (playPromise !== undefined) {
            (playPromise as Promise<void>).then(() => {
              console.log('[MPEGTS] ✅ Playback started successfully');
            }).catch((e: any) => {
              // Ignore AbortError which happens when pausing/unloading quickly
              if (e.name === 'AbortError') return;
              
              console.log('[MPEGTS] ⚠️ Autoplay with sound blocked, trying muted...', e);
              video.muted = true;
              (player.play() as Promise<void>).then(() => {
                console.log('[MPEGTS] ✅ Muted playback started');
              }).catch((e2: any) => {
                if (e2.name !== 'AbortError') {
                  console.error('[MPEGTS] ❌ Muted autoplay also blocked', e2);
                }
              });
            });
          }
        }

        player.on(mpegts.Events.ERROR, (type: any, details: any, data: any) => {
          console.error('[MPEGTS] ❌ ERROR Event:', { type, details, data });
          if (type === mpegts.ErrorTypes.NETWORK_ERROR) {
             // Check for 503 Service Unavailable
             if (data && data.code === 503) {
               handlePlaybackError(
                 'Stream unavailable (503). The channel server is temporarily down.',
                 PlayerErrorType.NETWORK_ERROR,
                 true
               );
             } else {
               handlePlaybackError(
                 'Network error',
                 PlayerErrorType.NETWORK_ERROR,
                 true
               );
             }
          } else {
            handlePlaybackError(
              `MPEGTS error: ${details}`,
              PlayerErrorType.MEDIA_ERROR,
              true
            );
          }
        });

        player.on(mpegts.Events.LOADING_COMPLETE, () => {
          console.log('[MPEGTS] ✅ LOADING_COMPLETE event');
          setLoading(false);
        });
        
        // Add MEDIA_INFO event to see stream metadata
        player.on(mpegts.Events.MEDIA_INFO, (mediaInfo: any) => {
          console.log('[MPEGTS] 📊 MEDIA_INFO event:', mediaInfo);
        });
        
        // Add METADATA_ARRIVED event
        player.on(mpegts.Events.METADATA_ARRIVED, (metadata: any) => {
          console.log('[MPEGTS] 📋 METADATA_ARRIVED event:', metadata);
        });
        
        // Add SCRIPTDATA_ARRIVED event
        player.on(mpegts.Events.SCRIPTDATA_ARRIVED, (data: any) => {
          console.log('[MPEGTS] 📜 SCRIPTDATA_ARRIVED event:', data);
        });

        // Monitor statistics
        const statsInterval = setInterval(() => {
          if (player && mpegtsPlayerRef.current) {
            try {
              const stats = player.statisticsInfo as any;
              if (stats) {
                // Only log if there's actual data
                if (stats.speed > 0 || stats.decodedFrames > 0) {
                  console.log('[MPEGTS] 📊 Stats:', {
                    speed: stats.speed,
                    decodedFrames: stats.decodedFrames,
                    droppedFrames: stats.droppedFrames,
                  });
                }
                
                setMetrics((prev) => ({
                  ...prev,
                  currentBitrate: (stats.speed || 0) * 8 * 1024, // speed is in KB/s
                  droppedFrames: (stats.decodedFrames || 0) - (stats.renderedFrames || 0),
                }));
              }
            } catch (e) {
              // Ignore errors from accessing statistics
            }
          }
        }, 5000);

        // Stall detection and auto-recovery
        let lastCurrentTime = 0;
        let stallCount = 0;
        const maxStallCount = 3; // Allow 3 seconds of stall before recovery
        
        const stallInterval = setInterval(() => {
          const video = videoRef.current;
          if (!video || !mpegtsPlayerRef.current) return;
          
          // Check if video is supposed to be playing but isn't progressing
          if (!video.paused && !video.ended && video.readyState >= 2) {
            if (video.currentTime === lastCurrentTime && video.currentTime > 0) {
              stallCount++;
              console.warn(`[MPEGTS] ⚠️ Stall detected at ${video.currentTime}s (count: ${stallCount})`);
              
              if (stallCount >= maxStallCount) {
                console.warn('[MPEGTS] 🔄 Attempting recovery...');
                try {
                  // Try to recover by reloading the stream
                  mpegtsPlayerRef.current.unload();
                  mpegtsPlayerRef.current.load();
                  mpegtsPlayerRef.current.play();
                  stallCount = 0;
                } catch (e) {
                  console.error('[MPEGTS] ❌ Recovery failed:', e);
                }
              }
            } else {
              // Video is progressing, reset stall count
              if (stallCount > 0) {
                console.log('[MPEGTS] ✅ Playback resumed');
              }
              stallCount = 0;
              lastCurrentTime = video.currentTime;
            }
          } else {
            // Reset if video is paused or ended
            stallCount = 0;
            lastCurrentTime = video.currentTime;
          }
          
          // Also handle unexpected 'ended' state for live streams
          if (video.ended && !video.paused) {
            console.warn('[MPEGTS] ⚠️ Live stream ended unexpectedly, attempting recovery...');
            try {
              mpegtsPlayerRef.current.unload();
              mpegtsPlayerRef.current.load();
              mpegtsPlayerRef.current.play();
            } catch (e) {
              console.error('[MPEGTS] ❌ Recovery from ended state failed:', e);
            }
          }
        }, 1000);

        return () => {
          clearInterval(statsInterval);
          clearInterval(stallInterval);
        };
      } else {
        console.error('[MPEGTS] ❌ MPEG-TS is not supported in this browser');
        setError('MPEG-TS is not supported in this browser.');
        setLoading(false);
      }
    } catch (error) {
      console.error('[MPEGTS] ❌ Failed to load mpegts.js:', error);
      handlePlaybackError(
        'Failed to initialize MPEG-TS player',
        PlayerErrorType.UNKNOWN_ERROR,
        true
      );
    }
  };

  if (!src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-gray-500">
        <p>Select a channel to play</p>
      </div>
    );
  }



  const toggleFullscreen = () => {
    const video = videoRef.current;
    const container = containerRef.current;
    
    if (!container || !video) return;

    // Check if already in fullscreen
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement || 
      (document as any).webkitFullscreenElement ||
      (document as any).webkitDisplayingFullscreen
    );

    if (!isCurrentlyFullscreen) {
      // Enter fullscreen
      // Try iOS Safari video fullscreen first (for iPhone/iPad)
      if ((video as any).webkitEnterFullscreen) {
        try {
          (video as any).webkitEnterFullscreen();
          return;
        } catch (e) {

        }
      }
      
      // Fallback to container fullscreen (for desktop/Android)
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if ((container as any).webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
      } else if ((container as any).msRequestFullscreen) {
        (container as any).msRequestFullscreen();
      }
    } else {
      // Exit fullscreen
      if ((video as any).webkitExitFullscreen) {
        try {
          (video as any).webkitExitFullscreen();
        } catch (e) {

        }
      }
      
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full bg-black group overflow-hidden"
      onDoubleClick={toggleFullscreen}
    >
      {/* Loading Spinner / Conversion Progress */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/50 backdrop-blur-sm">
          <Loader2 className="w-10 h-10 text-white animate-spin mb-2" />
          {isTransmuxing ? (
            <>
              <p className="text-white text-sm mb-2">Converting MKV to MP4...</p>
              <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${transmuxProgress}%` }}
                />
              </div>
              <p className="text-white text-xs mt-2">{Math.round(transmuxProgress)}%</p>
            </>
          ) : (
            <p className="text-white text-sm">Loading stream...</p>
          )}
        </div>
      )}

      {/* Buffering Indicator */}
      {!loading && buffering && (
        <div className="absolute top-4 right-4 z-20 bg-black/70 backdrop-blur-sm px-3 py-2 rounded-lg flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-white animate-spin" />
          <span className="text-white text-sm">Buffering...</span>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/90 text-white p-6 text-center">
          <AlertCircle className="w-12 h-12 mb-3 text-red-400" />
          <p className="mb-2 text-lg font-semibold">Playback Error</p>
          <p className="mb-6 text-gray-300 max-w-md">{error}</p>
          
          {/* Download Button for failed streams */}
          {src && (
            <div className="flex flex-col items-center gap-3">
              {src.includes('.mkv') && (
                <p className="text-sm text-yellow-400 mb-2">
                  ⚠️ MKV files cannot be played in browser. Please download to watch in VLC or other media player.
                </p>
              )}
              <a 
                href={src} 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all transform hover:scale-105 flex items-center gap-2 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <Film className="w-5 h-5" />
                <span className="font-semibold">Download Video</span>
              </a>
              <p className="text-xs text-gray-400 mt-2">
                Recommended: VLC Media Player (supports multi-audio & subtitles)
              </p>
            </div>
          )}
          
          {retryCountRef.current > 0 && !src.includes('.mkv') && (
            <p className="text-sm text-gray-400 mt-4">
              Retry attempt: {retryCountRef.current}/{maxRetries}
            </p>
          )}
        </div>
      )}

      {/* Fullscreen Button - Always Visible */}
      <button
        onClick={toggleFullscreen}
        className="absolute bottom-4 right-4 z-30 bg-black/80 backdrop-blur-sm p-3 rounded-full text-white shadow-lg hover:bg-black/90 active:scale-95 transition-all md:bottom-20"
        title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
      >
        {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
      </button>

      {/* Video Element */}
      <video
        ref={videoRef}
        className={`w-full h-full ${isFullscreen ? 'object-cover' : 'object-contain'}`}
        controls
        poster={poster}
        playsInline
        preload="auto"
        style={{ WebkitPlaysinline: 1 } as any}
      />
    </div>
  );
}
