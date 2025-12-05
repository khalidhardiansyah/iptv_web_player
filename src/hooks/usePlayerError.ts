/**
 * usePlayerError Hook
 * Manages player error state and recovery logic
 */

import { useState, useCallback } from 'react';
import { logger } from '@/lib/video-player/player-logger';

export type PlayerErrorType = 'network' | 'decode' | 'source' | 'unknown';

interface PlayerError {
  message: string;
  type: PlayerErrorType;
  fatal: boolean;
}

export function usePlayerError() {
  const [error, setError] = useState<PlayerError | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  const handleError = useCallback((message: string, type: PlayerErrorType, fatal = true) => {
    const errorObj: PlayerError = { message, type, fatal };
    setError(errorObj);
    
    logger.playerError('Player', message, { type, fatal });
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setIsRecovering(false);
  }, []);

  const attemptRecovery = useCallback(() => {
    setIsRecovering(true);
    logger.recoveryAttempt('Player');
  }, []);

  return {
    error,
    isRecovering,
    handleError,
    clearError,
    attemptRecovery
  };
}
