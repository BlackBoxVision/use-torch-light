import { useState, useCallback } from 'react';

import { log, isFunction } from '../helpers/utils';

export type UseTorchLightHook = (
  /**
   * Stream associated to the camera that contains flash
   */
  stream: MediaStream,
  /**
   * Options to customize the hook behaviour
   */
  options?: UseTorchLightHookOptions
) => UseTorchLightHookReturnType;

export type UseTorchLightHookReturnType = [boolean, () => Promise<void>];
export type UseTorchLightHookOptions = {
  /**
   * Enables debug mode
   */
  debug: boolean;
  /**
   * Quantify vibration when flash is on and off
   */
  vibrate: number;
  /**
   * Error callback, gets fired if applying media constraints results in error
   */
  onError?: (err: Error) => void;
  /**
   * Success callback, gets fired if applying media constraints results successfully
   */
  onSuccess?: (props: UseTorchLightHookOnSuccessProps) => void;
};

export type UseTorchLightHookOnSuccessProps = {
  on?: boolean;
  stream?: MediaStream;
  track?: MediaStreamTrack;
};

const defaultOptions: UseTorchLightHookOptions = {
  debug: false,
  vibrate: 70,
};

export const useTorchLight: UseTorchLightHook = (
  stream: MediaStream | any,
  {
    debug,
    vibrate,
    onError,
    onSuccess,
  }: UseTorchLightHookOptions = defaultOptions
): UseTorchLightHookReturnType => {
  const [on, setOn] = useState(false);

  if (!(stream instanceof MediaStream)) {
    log('[UseTorchLight]: Initial stream is not a valid MediaStream instance.', 'red', { debug });
    // Not calling onError here as turnOn/turnOff will handle it, preventing double calls.
    // The hook will return callable functions, but they will fail gracefully.
  }

  const turnOn = useCallback(async () => {
    window.navigator.vibrate([vibrate]);

    if (!stream || !(stream instanceof MediaStream)) {
      log('[UseTorchLight]: turnOn - Stream is not available or invalid.', 'red', { debug });
      if (isFunction(onError)) {
        onError(new Error('Stream is not available or invalid for turning on torch.'));
      }
      return;
    }

    const tracks = stream.getTracks();
    if (tracks.length === 0) {
      log('[UseTorchLight]: turnOn - No tracks found in the stream.', 'red', { debug });
      if (isFunction(onError)) {
        onError(new Error('No tracks found in the stream for turning on torch.'));
      }
      return;
    }
    
    // Assuming the first track is the one with torch capabilities. 
    // More sophisticated track selection might be needed for complex scenarios.
    const track = tracks[0]; 

    if (!(track instanceof MediaStreamTrack)) {
      // This case should ideally not be reached if tracks.length > 0, 
      // as getTracks() should return MediaStreamTrack objects.
      // Adding for robustness.
      log('[UseTorchLight]: turnOn - First track is not a valid MediaStreamTrack.', 'red', { debug });
      if (isFunction(onError)) {
        onError(new Error('First track is not a valid MediaStreamTrack for turning on torch.'));
      }
      return;
    }

    let lastError: Error | null = null;
    let torchTurnedOn = false;

    let torchTurnedOn = false;

    // 1. Try track.getCapabilities()
    log('[UseTorchLight]: Attempting to turn on torch using track.getCapabilities().', 'blue', { debug });
    if (typeof track.getCapabilities === 'function') {
      try {
        const capabilities = track.getCapabilities();
        // Ensure capabilities is an object and torch property exists
        if (capabilities && typeof capabilities === 'object' && 'torch' in capabilities && capabilities.torch) {
          log('[UseTorchLight]: track.getCapabilities() supports torch. Checking applyConstraints.', 'blue', { debug });
          if (typeof track.applyConstraints === 'function') {
            await track.applyConstraints({ advanced: [{ torch: true }] });
            setOn(true);
            torchTurnedOn = true;
            if (isFunction(onSuccess)) {
              onSuccess({ track, on: true });
            }
            log('[UseTorchLight]: Torch turned on successfully using track.getCapabilities().', 'green', { debug });
            return;
          } else {
            log('[UseTorchLight]: track.applyConstraints() is not a function on this track (needed for getCapabilities path).', 'yellow', { debug });
            lastError = new Error('track.applyConstraints is not a function.');
          }
        } else {
          log('[UseTorchLight]: track.getCapabilities() does not support torch or capabilities object is invalid.', 'yellow', { debug });
        }
      } catch (err) {
        lastError = err;
        log(`[UseTorchLight]: Error using track.getCapabilities(): ${err.message}`, 'red', { debug });
      }
    } else {
      log('[UseTorchLight]: track.getCapabilities() is not a function on this track.', 'yellow', { debug });
    }

    // 2. Try ImageCapture API
    if (!torchTurnedOn) {
      log('[UseTorchLight]: Attempting to turn on torch using ImageCapture API.', 'blue', { debug });
      if (typeof window.ImageCapture === 'function') {
        try {
          // @ts-ignore: ImageCapture might not be recognized by older TypeScript versions
          const imageCapture = new ImageCapture(track);
          log('[UseTorchLight]: ImageCapture instance created. Getting photo capabilities.', 'blue', { debug });
          const photoCapabilities = await imageCapture.getPhotoCapabilities();

          // Ensure photoCapabilities is an object and fillLightMode is an array
          if (photoCapabilities && typeof photoCapabilities === 'object' && 
              photoCapabilities.fillLightMode && Array.isArray(photoCapabilities.fillLightMode) && 
              photoCapabilities.fillLightMode.includes('flash')) {
            log('[UseTorchLight]: ImageCapture supports flash via fillLightMode. Checking applyConstraints.', 'blue', { debug });
            if (typeof track.applyConstraints === 'function') {
              // The `as any` is used here because 'torch' in advanced constraints might not be in standard TS lib for MediaTrackConstraints.
              await track.applyConstraints({
                advanced: [{ torch: true } as any], 
              });
              setOn(true);
              torchTurnedOn = true;
              if (isFunction(onSuccess)) {
                onSuccess({ track, on: true });
              }
              log('[UseTorchLight]: Torch turned on successfully using ImageCapture.', 'green', { debug });
              return;
            } else {
              log('[UseTorchLight]: track.applyConstraints() is not a function on this track (needed for ImageCapture path).', 'yellow', { debug });
              lastError = new Error('track.applyConstraints is not a function.');
            }
          } else {
            log('[UseTorchLight]: ImageCapture does not support flash via fillLightMode or photoCapabilities object is invalid.', 'yellow', { debug });
          }
        } catch (err) {
          lastError = err;
          log(`[UseTorchLight]: Error using ImageCapture: ${err.message}`, 'red', { debug });
        }
      } else {
        log('[UseTorchLight]: window.ImageCapture is not a function.', 'yellow', { debug });
      }
    }

    // 3. Fallback: Direct applyConstraints
    if (!torchTurnedOn) {
      log('[UseTorchLight]: Attempting to turn on torch using fallback applyConstraints.', 'blue', { debug });
      if (typeof track.applyConstraints === 'function') {
        try {
          // The `as any` is used here because 'torch' in advanced constraints might not be in standard TS lib for MediaTrackConstraints.
          await track.applyConstraints({
            advanced: [{ torch: true } as any], 
          });
          setOn(true);
          torchTurnedOn = true;
          if (isFunction(onSuccess)) {
            onSuccess({ track, on: true });
          }
          log('[UseTorchLight]: Torch turned on successfully using fallback applyConstraints.', 'green', { debug });
          return;
        } catch (err) {
          lastError = err;
          log(`[UseTorchLight]: Error using fallback applyConstraints: ${err.message}`, 'red', { debug });
        }
      } else {
        log('[UseTorchLight]: track.applyConstraints() is not a function on this track (needed for fallback path).', 'yellow', { debug });
        lastError = new Error('track.applyConstraints is not a function.');
      }
    }

    // If all methods failed
    if (!torchTurnedOn) {
      log('[UseTorchLight]: All methods to turn on torch failed.', 'red', { debug });
      if (lastError && isFunction(onError)) {
        onError(lastError);
      } else if (isFunction(onError)) {
        // If no specific error was caught by lastError, but torch is still not on
        onError(new Error('All methods to turn on torch failed. No specific error was captured.'));
      }
    }
  }, [stream, vibrate, debug, onError, onSuccess]);

  const turnOff = useCallback(async () => {
    window.navigator.vibrate([vibrate]);

    if (!stream || !(stream instanceof MediaStream)) {
      log('[UseTorchLight]: turnOff - Stream is not available or invalid.', 'red', { debug });
      if (isFunction(onError)) {
        onError(new Error('Stream is not available or invalid for turning off torch.'));
      }
      return;
    }

    const tracks = stream.getTracks();
    if (tracks.length === 0) {
      log('[UseTorchLight]: turnOff - No tracks found in the stream.', 'red', { debug });
      if (isFunction(onError)) {
        onError(new Error('No tracks found in the stream for turning off torch.'));
      }
      setOn(false); // Still set to false as the intent is to turn off
      return;
    }

    const videoTrack = tracks.find(t => t.kind !== 'audio'); 

    if (!videoTrack || !(videoTrack instanceof MediaStreamTrack)) {
      log('[UseTorchLight]: turnOff - No suitable MediaStreamTrack found (non-audio).', 'red', { debug });
      if (isFunction(onError)) {
        onError(new Error('No suitable MediaStreamTrack found (non-audio) to turn off torch.'));
      }
      setOn(false); // User intent is to turn off
      return;
    }

    log('[UseTorchLight]: Attempting to turn off torch using videoTrack.applyConstraints.', 'blue', { debug });
    if (typeof videoTrack.applyConstraints === 'function') {
      try {
        // The `as any` is used here because 'torch' in advanced constraints might not be in standard TS lib for MediaTrackConstraints.
        await videoTrack.applyConstraints({
          advanced: [{ torch: false } as any], 
        });
        log('[UseTorchLight]: Torch turned off successfully via applyConstraints.', 'green', { debug });
        if (isFunction(onSuccess)) {
          onSuccess({ track: videoTrack, on: false });
        }
      } catch (err) {
        log(`[UseTorchLight]: Error turning off torch: ${err.message}`, 'red', { debug });
        if (isFunction(onError)) {
          onError(err);
        }
      } finally {
        setOn(false);
      }
    } else {
      log('[UseTorchLight]: turnOff - videoTrack.applyConstraints() is not a function.', 'red', { debug });
      if (isFunction(onError)) {
        onError(new Error('videoTrack.applyConstraints is not a function for turning off torch.'));
      }
      // Ensure setOn(false) is called even if applyConstraints is not available,
      // as the intent is to be in the 'off' state.
      setOn(false);
    }
  }, [stream, vibrate, debug, onError, onSuccess]);

  return [on, on ? turnOff : turnOn];
};
