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

  const turnOn = useCallback(async () => {
    try {
      window.navigator.vibrate([vibrate]);

      if (stream) {
        const [track] = stream.getTracks();

        if (track instanceof MediaStreamTrack) {
          try {
            // ImageCapture is a new specification supported in modern browsers
            const imageCapture = new ImageCapture(track);
            const capabilities = await imageCapture.getPhotoCapabilities();

            if (capabilities.fillLightMode.includes('flash')) {
              await track.applyConstraints({
                advanced: [{ torch: true } as any],
              });

              if (isFunction(onSuccess)) {
                onSuccess({ track, on });
              }
            }
          } catch (err) {
            log(`[UseTorchLight]: error ${err.message}`, 'red', { debug });

            // If errored, we can go to fallback forcing to apply the constraints
            try {
              await track.applyConstraints({
                advanced: [{ torch: true } as any],
              });
            } catch (err) {
              log(`[UseTorchLight]: error ${err.message}`, 'red', { debug });

              if (isFunction(onError)) {
                onError(err);
              }
            }

            if (isFunction(onError)) {
              onError(err);
            }
          }

          setOn(true);
        }
      }
    } catch (err) {
      log(`[UseTorchLight]: error ${err.message}`, 'red', { debug });
    }
  }, [stream, vibrate, debug]);

  const turnOff = useCallback(async () => {
    window.navigator.vibrate([vibrate]);

    if (stream) {
      const pc: RTCPeerConnection | any = new RTCPeerConnection();

      // Older way for browsers
      if ('applyConstraints' in stream) {
        try {
          await stream?.applyConstraints({
            advanced: [{ torch: false } as any],
          });

          if ('addStream' in pc) {
            pc?.addStream(stream);
          }

          if (isFunction(onSuccess)) {
            onSuccess({ stream, on });
          }
        } catch (err) {
          log(`[UseTorchLight]: error ${err.message}`, 'red', { debug });

          if (isFunction(onError)) {
            onError(err);
          }
        }

        // New way for modern browsers
      } else {
        const tracks: MediaStreamTrack[] = stream.getTracks();

        for (let track of tracks) {
          try {
            await track.applyConstraints({
              advanced: [{ torch: false } as any],
            });

            pc.addTrack(track, stream);

            if (isFunction(onSuccess)) {
              onSuccess({ track, on });
            }
          } catch (err) {
            log(`[UseTorchLight]: error ${err.message}`, 'red', { debug });

            if (isFunction(onError)) {
              onError(err);
            }
          }
        }
      }

      setOn(false);
    }
  }, [stream, vibrate, debug]);

  return [on, on ? turnOff : turnOn];
};
