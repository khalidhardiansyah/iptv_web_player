/**
 * Player Logger Utility
 * Centralized logging for video player with consistent formatting
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogOptions {
  prefix?: string;
  emoji?: string;
  data?: any;
}

class PlayerLogger {
  private enabled: boolean = process.env.NODE_ENV === 'development';

  /**
   * Log info message
   */
  info(message: string, options?: LogOptions) {
    if (!this.enabled) return;
    const prefix = options?.prefix || 'Player';
    const emoji = options?.emoji || 'ℹ️';
    console.log(`[${prefix}] ${emoji} ${message}`, options?.data || '');
  }

  /**
   * Log warning message
   */
  warn(message: string, options?: LogOptions) {
    if (!this.enabled) return;
    const prefix = options?.prefix || 'Player';
    const emoji = options?.emoji || '⚠️';
    console.warn(`[${prefix}] ${emoji} ${message}`, options?.data || '');
  }

  /**
   * Log error message
   */
  error(message: string, options?: LogOptions) {
    const prefix = options?.prefix || 'Player';
    const emoji = options?.emoji || '❌';
    console.error(`[${prefix}] ${emoji} ${message}`, options?.data || '');
  }

  /**
   * Log debug message (only in development)
   */
  debug(message: string, options?: LogOptions) {
    if (!this.enabled) return;
    const prefix = options?.prefix || 'Player';
    const emoji = options?.emoji || '🔍';
    console.log(`[${prefix}] ${emoji} ${message}`, options?.data || '');
  }

  /**
   * Log player initialization
   */
  playerInit(playerType: string, url: string) {
    this.info(`Initializing ${playerType} player`, {
      prefix: playerType.toUpperCase(),
      emoji: '🎬',
      data: { url: url.substring(0, 100) + '...' }
    });
  }

  /**
   * Log player success
   */
  playerSuccess(playerType: string, message: string) {
    this.info(message, {
      prefix: playerType.toUpperCase(),
      emoji: '✅'
    });
  }

  /**
   * Log player error
   */
  playerError(playerType: string, message: string, error?: any) {
    this.error(message, {
      prefix: playerType.toUpperCase(),
      data: error
    });
  }

  /**
   * Log player event
   */
  playerEvent(playerType: string, eventName: string, data?: any) {
    this.debug(`${eventName} event`, {
      prefix: playerType.toUpperCase(),
      emoji: '📊',
      data
    });
  }

  /**
   * Log stall detection
   */
  stallDetected(playerType: string, time: number, count: number) {
    this.warn(`Stall detected at ${time.toFixed(6)}s (count: ${count})`, {
      prefix: playerType.toUpperCase()
    });
  }

  /**
   * Log recovery attempt
   */
  recoveryAttempt(playerType: string) {
    this.info('Attempting recovery...', {
      prefix: playerType.toUpperCase(),
      emoji: '🔄'
    });
  }
}

// Export singleton instance
export const logger = new PlayerLogger();

// Export class for testing
export { PlayerLogger };
