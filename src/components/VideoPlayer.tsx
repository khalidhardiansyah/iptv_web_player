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
}

export default function VideoPlayer({ src, poster, autoPlay = true }: VideoPlayerProps) {
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
        // Check if player instance is valid before calling methods
        if (mpegtsPlayerRef.current) {
          try {
             mpegtsPlayerRef.current.unload();
          } catch (unloadError: any) {
             // Ignore specific unload error from mpegts.js
             if (unloadError?.message?.includes('Cannot read properties of null')) {
               // This is a known bug in mpegts.js during cleanup
             } else {
               console.warn('Error unloading mpegts player:', unloadError);
             }
          }
          
          try {
            mpegtsPlayerRef.current.destroy();
          } catch (destroyError) {
             console.warn('Error destroying mpegts player:', destroyError);
          }
        }
      } catch (e) {
        console.warn('General error cleaning up mpegts player:', e);
      }
      mpegtsPlayerRef.current = null;
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
    const shouldUseProxy = useProxy || (format === StreamFormat.MPEGTS && !src.includes('/api/stream'));
    
    if (shouldUseProxy) {
      const encodedUrl = encodeURIComponent(src);
      // Convert to absolute URL for worker compatibility
      if (typeof window !== 'undefined') {
        finalUrl = `${window.location.origin}/api/stream?url=${encodedUrl}`;
      } else {
        finalUrl = `/api/stream?url=${encodedUrl}`;
      }
    }




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
          mpegtsPlayerRef.current.unload();
          mpegtsPlayerRef.current.destroy();
        } catch (e) {
          console.warn('Error cleaning up mpegts player:', e);
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
      if (!useProxy && retryCountRef.current >= 1) {

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
      // Dynamically import mpegts.js
      const mpegts = (await import('mpegts.js')).default;

      if (mpegts.isSupported()) {
        const player = mpegts.createPlayer({
          type: 'mpegts',
          url: url,
          isLive: true,
          cors: true,
        }, {
          enableWorker: !capabilities.isLowEnd,
          lazyLoadMaxDuration: 3 * 60,
          seekType: 'range',
        });

        mpegtsPlayerRef.current = player;
        player.attachMediaElement(video);
        
        // Removed forced mute to allow playing with sound if possible
        // video.muted = true;
        
        player.load();

        if (autoPlay) {
          const playPromise = player.play();
          if (playPromise !== undefined) {
            (playPromise as Promise<void>).catch((e: any) => {
              // Ignore AbortError which happens when pausing/unloading quickly
              if (e.name === 'AbortError') return;
              
              console.log('Autoplay with sound blocked, trying muted...', e);
              video.muted = true;
              (player.play() as Promise<void>).catch((e2: any) => {
                if (e2.name !== 'AbortError') {
                  console.log('Muted autoplay also blocked', e2);
                }
              });
            });
          }
        }

        player.on(mpegts.Events.ERROR, (type: any, details: any, data: any) => {
          console.error('MPEGTS Error:', { type, details, data });
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
          setLoading(false);
        });

        // Monitor statistics
        const statsInterval = setInterval(() => {
          if (player && mpegtsPlayerRef.current) {
            try {
              const stats = player.statisticsInfo as any;
              if (stats) {
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
        }, 1000);

        return () => clearInterval(statsInterval);
      } else {
        setError('MPEG-TS is not supported in this browser.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to load mpegts.js:', error);
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
