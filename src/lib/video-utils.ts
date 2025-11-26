/**
 * Video Player Utility Functions
 */

import { StreamFormat, DeviceCapabilities, StreamInfo } from '@/types/video-player.types';

/**
 * Detect stream format from URL
 */
export function detectStreamFormat(url: string): StreamFormat {
  if (!url) return StreamFormat.UNKNOWN;

  const urlLower = url.toLowerCase();

  if (urlLower.includes('.m3u8') || urlLower.includes('m3u8')) {
    return StreamFormat.HLS;
  }

  if (urlLower.includes('.mpd') || urlLower.includes('mpd')) {
    return StreamFormat.DASH;
  }

  if (urlLower.includes('.mp4')) {
    return StreamFormat.MP4;
  }

  if (urlLower.includes('.ts') || urlLower.includes('extension=ts') || urlLower.includes('ext=.ts')) {
    return StreamFormat.MPEGTS;
  }

  // Default to HLS for IPTV streams
  return StreamFormat.HLS;
}

/**
 * Detect device capabilities
 */
export function getDeviceCapabilities(): DeviceCapabilities {
  // Check if running in browser
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isMobile: false,
      isLowEnd: false,
      supportsHardwareAcceleration: false,
      screenWidth: 1920,
      screenHeight: 1080,
      devicePixelRatio: 1,
      connection: undefined,
    };
  }

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  const screenWidth = window.innerWidth || screen.width;
  const screenHeight = window.innerHeight || screen.height;
  const devicePixelRatio = window.devicePixelRatio || 1;

  // Estimate if device is low-end based on screen size and pixel ratio
  const isLowEnd = isMobile && (screenWidth < 720 || devicePixelRatio < 2);

  // Check for hardware acceleration support
  const supportsHardwareAcceleration = checkHardwareAcceleration();

  // Get network information if available
  const connection = getNetworkInfo();

  return {
    isMobile,
    isLowEnd,
    supportsHardwareAcceleration,
    screenWidth,
    screenHeight,
    devicePixelRatio,
    connection,
  };
}

/**
 * Check for hardware acceleration support
 */
function checkHardwareAcceleration(): boolean {
  if (typeof document === 'undefined') return false;
  
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch (e) {
    return false;
  }
}

/**
 * Get network information
 */
function getNetworkInfo() {
  const nav = navigator as any;
  if (nav.connection || nav.mozConnection || nav.webkitConnection) {
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
    };
  }
  return undefined;
}

/**
 * Get optimal HLS.js configuration based on device capabilities
 */
export function getOptimalHlsConfig(capabilities: DeviceCapabilities) {
  const baseConfig = {
    enableWorker: true,
    lowLatencyMode: true,
    backBufferLength: 90,
    maxBufferLength: 30,
    maxMaxBufferLength: 600,
    maxBufferSize: 60 * 1000 * 1000,
    maxBufferHole: 0.5,
    highBufferWatchdogPeriod: 2,
    nudgeOffset: 0.1,
    nudgeMaxRetry: 3,
    maxFragLookUpTolerance: 0.25,
    liveSyncDurationCount: 3,
    liveMaxLatencyDurationCount: 10,
    liveDurationInfinity: false,
    enableWebVTT: true,
    enableCEA708Captions: true,
    stretchShortVideoTrack: false,
    maxAudioFramesDrift: 1,
    forceKeyFrameOnDiscontinuity: true,
    abrEwmaFastLive: 3,
    abrEwmaSlowLive: 9,
    abrEwmaFastVoD: 3,
    abrEwmaSlowVoD: 9,
    abrEwmaDefaultEstimate: 500000,
    abrBandWidthFactor: 0.95,
    abrBandWidthUpFactor: 0.7,
    abrMaxWithRealBitrate: false,
    maxStarvationDelay: 4,
    maxLoadingDelay: 4,
    minAutoBitrate: 0,
    emeEnabled: true,
    testBandwidth: true,
    progressive: true,
    fpsDroppedMonitoringPeriod: 5000,
    fpsDroppedMonitoringThreshold: 0.2,
    appendErrorMaxRetry: 3,
    manifestLoadingTimeOut: 10000,
    manifestLoadingMaxRetry: 1,
    manifestLoadingRetryDelay: 1000,
    manifestLoadingMaxRetryTimeout: 64000,
    levelLoadingTimeOut: 10000,
    levelLoadingMaxRetry: 4,
    levelLoadingRetryDelay: 1000,
    levelLoadingMaxRetryTimeout: 64000,
    fragLoadingTimeOut: 20000,
    fragLoadingMaxRetry: 6,
    fragLoadingRetryDelay: 1000,
    fragLoadingMaxRetryTimeout: 64000,
    startFragPrefetch: false,
    startLevel: undefined,
    debug: false,
    capLevelOnFPSDrop: false,
    capLevelToPlayerSize: false,
    ignoreDevicePixelRatio: false,
    initialLiveManifestSize: 1,
    maxLiveSyncPlaybackRate: 1,
  };

  // Adjust for mobile devices
  if (capabilities.isMobile) {
    return {
      ...baseConfig,
      maxBufferLength: 20, // Reduce buffer for mobile
      maxMaxBufferLength: 300, // Reduce max buffer
      maxBufferSize: 30 * 1000 * 1000, // 30MB for mobile
      backBufferLength: 30, // Less back buffer
    };
  }

  // Adjust for low-end devices
  if (capabilities.isLowEnd) {
    return {
      ...baseConfig,
      maxBufferLength: 15,
      maxMaxBufferLength: 180,
      maxBufferSize: 20 * 1000 * 1000,
      backBufferLength: 20,
      enableWorker: false, // Disable worker on low-end devices
    };
  }

  // Adjust for slow network
  if (capabilities.connection?.effectiveType === 'slow-2g' || 
      capabilities.connection?.effectiveType === '2g') {
    return {
      ...baseConfig,
      maxBufferLength: 10,
      abrBandWidthFactor: 0.8, // More conservative bandwidth usage
      abrBandWidthUpFactor: 0.5, // Slower quality upgrades
    };
  }

  return baseConfig;
}

/**
 * Get optimal Dash.js configuration based on device capabilities
 */
export function getOptimalDashConfig(capabilities: DeviceCapabilities) {
  const baseConfig = {
    streaming: {
      lowLatencyEnabled: true,
      liveDelay: 3,
      bufferTimeAtTopQuality: 30,
      bufferTimeAtTopQualityLongForm: 60,
      bufferToKeep: 20,
      stableBufferTime: 12,
      bufferPruningInterval: 10,
      fastSwitchEnabled: true,
      abr: {
        useDefaultABRRules: true,
        ABRStrategy: 'abrDynamic' as const,
        bandwidthSafetyFactor: 0.9,
        usePixelRatioInLimitBitrateByPortal: false,
        maxBitrate: { audio: -1, video: -1 },
        minBitrate: { audio: -1, video: -1 },
        maxRepresentationRatio: { audio: 1, video: 1 },
        initialBitrate: { audio: -1, video: -1 },
        initialRepresentationRatio: { audio: -1, video: -1 },
        autoSwitchBitrate: { audio: true, video: true },
      },
      retryAttempts: {
        MPD: 3,
        XLinkExpansion: 1,
        MediaSegment: 3,
        InitializationSegment: 3,
        BitstreamSwitchingSegment: 3,
        IndexSegment: 3,
        FragmentInfoSegment: 3,
        license: 3,
      },
      retryIntervals: {
        MPD: 500,
        XLinkExpansion: 500,
        MediaSegment: 1000,
        InitializationSegment: 1000,
        BitstreamSwitchingSegment: 1000,
        IndexSegment: 1000,
        FragmentInfoSegment: 1000,
        license: 1000,
      },
    },
  };

  // Adjust for mobile devices
  if (capabilities.isMobile) {
    return {
      ...baseConfig,
      streaming: {
        ...baseConfig.streaming,
        bufferTimeAtTopQuality: 20,
        bufferTimeAtTopQualityLongForm: 40,
        bufferToKeep: 15,
        stableBufferTime: 8,
      },
    };
  }

  // Adjust for low-end devices
  if (capabilities.isLowEnd) {
    return {
      ...baseConfig,
      streaming: {
        ...baseConfig.streaming,
        bufferTimeAtTopQuality: 15,
        bufferTimeAtTopQualityLongForm: 30,
        bufferToKeep: 10,
        stableBufferTime: 6,
        fastSwitchEnabled: false,
      },
    };
  }

  return baseConfig;
}

/**
 * Parse stream info from URL
 */
export function parseStreamInfo(url: string): StreamInfo {
  return {
    url,
    format: detectStreamFormat(url),
  };
}

/**
 * Check if browser supports native HLS
 */
export function supportsNativeHLS(): boolean {
  if (typeof document === 'undefined') return false;
  
  const video = document.createElement('video');
  return video.canPlayType('application/vnd.apple.mpegurl') !== '';
}

/**
 * Estimate optimal quality based on network speed
 */
export function estimateOptimalQuality(capabilities: DeviceCapabilities): number {
  const connection = capabilities.connection;
  
  if (!connection) {
    return -1; // Auto
  }

  // Map effective type to quality level (0 = lowest, higher = better)
  const qualityMap: { [key: string]: number } = {
    'slow-2g': 0,
    '2g': 1,
    '3g': 2,
    '4g': 3,
  };

  return qualityMap[connection.effectiveType || '4g'] ?? -1;
}
