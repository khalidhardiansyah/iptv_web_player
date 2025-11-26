/**
 * Video Player Type Definitions
 */

export enum StreamFormat {
  HLS = 'hls',
  DASH = 'dash',
  MP4 = 'mp4',
  MPEGTS = 'mpegts',
  UNKNOWN = 'unknown',
}

export interface DeviceCapabilities {
  isMobile: boolean;
  isLowEnd: boolean;
  supportsHardwareAcceleration: boolean;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  };
}

export interface PlayerConfig {
  format: StreamFormat;
  hlsConfig?: any;
  dashConfig?: any;
}

export interface PerformanceMetrics {
  bufferLength: number;
  droppedFrames: number;
  currentBitrate: number;
  currentLevel: number;
  loadingTime: number;
  qualitySwitches: number;
}

export interface StreamInfo {
  url: string;
  format: StreamFormat;
}

export enum PlayerErrorType {
  NETWORK_ERROR = 'network_error',
  MEDIA_ERROR = 'media_error',
  MANIFEST_ERROR = 'manifest_error',
  UNKNOWN_ERROR = 'unknown_error',
}

export interface PlayerError {
  type: PlayerErrorType;
  message: string;
  fatal: boolean;
  details?: any;
}
