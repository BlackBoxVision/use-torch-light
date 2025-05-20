import { renderHook, act } from '@testing-library/react-hooks/dom'; // Using /dom for browser environment mocks
import { useTorchLight } from './useTorchLight';
import * as utils from '../helpers/utils'; // Import to spy on 'log'

// Mock global browser APIs
const mockVibrate = jest.fn();
const mockApplyConstraints = jest.fn();
const mockGetCapabilities = jest.fn();
const mockStop = jest.fn();
const mockGetPhotoCapabilities = jest.fn();

// Holder for the original ImageCapture
let OriginalImageCapture: any;

// Spy on the log function
const logSpy = jest.spyOn(utils, 'log');

interface MockTrack extends MediaStreamTrack {
  kind: string;
  applyConstraints: jest.Mock<Promise<void>, [MediaTrackConstraints?]>;
  getCapabilities: jest.Mock<MediaTrackCapabilities, []>;
  stop: jest.Mock<void, []>;
}

interface MockMediaStream extends MediaStream {
  getTracks: jest.Mock<MockTrack[], []>;
}

const createMockTrack = (kind = 'video', capabilities = {}, photoCapabilities = {}): MockTrack => {
  mockGetCapabilities.mockReturnValue(capabilities);
  mockGetPhotoCapabilities.mockResolvedValue(photoCapabilities); // Ensure this is resolved for ImageCapture
  mockApplyConstraints.mockResolvedValue(undefined); // Default to resolve

  return {
    kind,
    applyConstraints: mockApplyConstraints,
    getCapabilities: mockGetCapabilities,
    stop: mockStop,
    id: 'mock-track-id',
    enabled: true,
    label: 'Mock Track',
    muted: false,
    readyState: 'live',
    onended: null,
    onmute: null,
    onunmute: null,
    clone: jest.fn(),
    dispatchEvent: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    getSettings: jest.fn().mockReturnValue({}), // Add getSettings mock
    constraints: {}, // Add constraints property
    getConstraints: jest.fn().mockReturnValue({}), // Add getConstraints mock
  } as MockTrack;
};

const createMockStream = (tracks: MockTrack[]): MockMediaStream => ({
  getTracks: jest.fn().mockReturnValue(tracks),
  id: 'mock-stream-id',
  active: true,
  addTrack: jest.fn(),
  removeTrack: jest.fn(),
  clone: jest.fn(),
  dispatchEvent: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  getTrackById: jest.fn(),
  getVideoTracks: jest.fn().mockReturnValue(tracks.filter(t => t.kind === 'video')),
  getAudioTracks: jest.fn().mockReturnValue(tracks.filter(t => t.kind === 'audio')),
  onactive: null,
  onaddtrack: null,
  oninactive: null,
  onremovetrack: null,
}) as MockMediaStream;


describe('useTorchLight', () => {
  let mockStream: MockMediaStream;
  let mockTrack: MockTrack;

  beforeEach(() => {
    // Reset all mocks
    mockVibrate.mockClear();
    mockApplyConstraints.mockReset().mockResolvedValue(undefined); // Reset and default to resolve
    mockGetCapabilities.mockReset();
    mockStop.mockClear();
    mockGetPhotoCapabilities.mockReset();
    logSpy.mockClear();

    // Mock global navigator
    if (typeof global.navigator === 'undefined') {
      (global as any).navigator = {};
    }
    global.navigator.vibrate = mockVibrate;

    // Mock ImageCapture
    OriginalImageCapture = (global as any).ImageCapture; // Store original
    (global as any).ImageCapture = jest.fn().mockImplementation(() => ({
      getPhotoCapabilities: mockGetPhotoCapabilities,
      takePhoto: jest.fn().mockResolvedValue(new Blob()),
      grabFrame: jest.fn().mockResolvedValue(new ImageBitmap()),
      track: null, // Mock track property
    }));

    // Default mock track and stream for most tests
    mockTrack = createMockTrack('video');
    mockStream = createMockStream([mockTrack]);
  });

  afterEach(() => {
    // Restore original ImageCapture if it was changed
    if (OriginalImageCapture !== undefined) {
      (global as any).ImageCapture = OriginalImageCapture;
    }
  });

  // Test Scenarios
  it('should initialize with torch off', () => {
    const { result } = renderHook(() => useTorchLight(mockStream));
    const [on] = result.current;
    expect(on).toBe(false);
  });

  // 1. Successful Torch On/Off Cycle
  describe('Successful Torch On/Off Cycle', () => {
    it('should turn torch on and off via track.getCapabilities()', async () => {
      mockGetCapabilities.mockReturnValue({ torch: true });
      const onSuccess = jest.fn();
      const { result } = renderHook(() => useTorchLight(mockStream, { onSuccess }));

      // Turn on
      await act(async () => {
        await result.current[1](); // toggleTorch
      });
      expect(result.current[0]).toBe(true); // on
      expect(mockVibrate).toHaveBeenCalledTimes(1);
      expect(mockApplyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });
      expect(onSuccess).toHaveBeenCalledWith({ track: mockTrack, on: true });

      // Turn off
      await act(async () => {
        await result.current[1](); // toggleTorch
      });
      expect(result.current[0]).toBe(false); // on
      expect(mockVibrate).toHaveBeenCalledTimes(2);
      expect(mockApplyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: false }] });
      expect(onSuccess).toHaveBeenCalledWith({ track: mockTrack, on: false });
    });

    it('should turn torch on and off via ImageCapture', async () => {
      mockGetCapabilities.mockReturnValue({ torch: false }); // getCapabilities fails
      mockGetPhotoCapabilities.mockResolvedValue({ fillLightMode: ['flash', 'auto'] });
      const onSuccess = jest.fn();
      const { result } = renderHook(() => useTorchLight(mockStream, { onSuccess }));

      // Turn on
      await act(async () => {
        await result.current[1]();
      });
      expect(result.current[0]).toBe(true);
      expect(global.ImageCapture).toHaveBeenCalledWith(mockTrack);
      expect(mockApplyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });
      expect(onSuccess).toHaveBeenCalledWith({ track: mockTrack, on: true });

      // Turn off
      await act(async () => {
        await result.current[1]();
      });
      expect(result.current[0]).toBe(false);
      expect(mockApplyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: false }] });
      expect(onSuccess).toHaveBeenCalledWith({ track: mockTrack, on: false });
    });

    it('should turn torch on and off via fallback applyConstraints', async () => {
      mockGetCapabilities.mockReturnValue({ torch: false }); // getCapabilities fails
      (global as any).ImageCapture = undefined; // ImageCapture not available
      const onSuccess = jest.fn();
      const { result } = renderHook(() => useTorchLight(mockStream, { onSuccess }));

      // Turn on
      await act(async () => {
        await result.current[1]();
      });
      expect(result.current[0]).toBe(true);
      expect(mockApplyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });
      expect(onSuccess).toHaveBeenCalledWith({ track: mockTrack, on: true });
      
      // Turn off
      await act(async () => {
        await result.current[1]();
      });
      expect(result.current[0]).toBe(false);
      expect(mockApplyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: false }] });
      expect(onSuccess).toHaveBeenCalledWith({ track: mockTrack, on: false });
    });
  });

  // 2. Error Scenarios for turnOn
  describe('Error Scenarios for turnOn', () => {
    it('should call onError if stream is null', async () => {
      const onError = jest.fn();
      const { result } = renderHook(() => useTorchLight(null as any, { onError }));
      await act(async () => {
        await result.current[1]();
      });
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onError.mock.calls[0][0].message).toContain('Stream is not available or invalid');
      expect(result.current[0]).toBe(false);
    });

    it('should call onError if no tracks are available', async () => {
      const onError = jest.fn();
      const emptyStream = createMockStream([]);
      const { result } = renderHook(() => useTorchLight(emptyStream, { onError }));
      await act(async () => {
        await result.current[1]();
      });
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onError.mock.calls[0][0].message).toContain('No tracks found');
      expect(result.current[0]).toBe(false);
    });
    
    it('should call onError if getCapabilities, ImageCapture, and fallback all fail', async () => {
      mockGetCapabilities.mockReturnValue({ torch: false });
      mockGetPhotoCapabilities.mockResolvedValue({ fillLightMode: ['off'] }); // ImageCapture fails
      mockApplyConstraints.mockRejectedValue(new Error('Constraint failed')); // Fallback fails
      const onError = jest.fn();
      const { result } = renderHook(() => useTorchLight(mockStream, { onError }));

      await act(async () => {
        await result.current[1]();
      });
      expect(result.current[0]).toBe(false);
      expect(onError).toHaveBeenCalledWith(new Error('Constraint failed'));
      // Ensure applyConstraints was called for each attempt that uses it
      expect(mockApplyConstraints).toHaveBeenCalledTimes(1); // Only fallback attempts applyConstraints directly
    });

    it('should call onError if track.applyConstraints rejects for getCapabilities path', async () => {
      mockGetCapabilities.mockReturnValue({ torch: true });
      const constraintError = new Error('ApplyConstraint Failed');
      mockApplyConstraints.mockRejectedValueOnce(constraintError); // Fail on first attempt
      const onError = jest.fn();
      const { result } = renderHook(() => useTorchLight(mockStream, { onError }));

      await act(async () => {
        await result.current[1]();
      });
      expect(result.current[0]).toBe(false);
      // It will try ImageCapture and fallback after getCapabilities fails with applyConstraints
      // Let's assume ImageCapture and fallback also fail or are not applicable to isolate this
      mockGetPhotoCapabilities.mockResolvedValue({ fillLightMode: ['off'] }); 
      mockApplyConstraints.mockRejectedValueOnce(new Error('Fallback failed')); // ImageCapture constraint call
      mockApplyConstraints.mockRejectedValueOnce(new Error('Fallback failed again')); // Fallback constraint call


      // Re-render and re-trigger with specific mocks for subsequent failures
      mockApplyConstraints.mockReset();
      mockApplyConstraints.mockRejectedValueOnce(constraintError); // For getCapabilities
      mockGetPhotoCapabilities.mockResolvedValue({ fillLightMode: ['off'] }); // ImageCapture won't apply
      mockApplyConstraints.mockRejectedValueOnce(new Error('Final fallback fail')); // For fallback

      const { result: result2 } = renderHook(() => useTorchLight(mockStream, { onError }));
       await act(async () => {
        await result2.current[1]();
      });

      expect(result2.current[0]).toBe(false);
      expect(onError).toHaveBeenCalledWith(constraintError); // The first error from applyConstraints
    });
  });

  // 3. Error Scenarios for turnOff
  describe('Error Scenarios for turnOff', () => {
    it('should call onError if stream is null for turnOff', async () => {
      const onError = jest.fn();
      // First, turn it on successfully (e.g., via fallback)
      mockGetCapabilities.mockReturnValue({ torch: false });
      (global as any).ImageCapture = undefined;
      const { result } = renderHook(() => useTorchLight(mockStream, { onError }));
      await act(async () => {
        await result.current[1](); // Turn on
      });
      expect(result.current[0]).toBe(true);

      // Now, set stream to null and try to turn off
      const { result: resultNullStream } = renderHook(() => useTorchLight(null as any, { onError }));
       // Manually set 'on' state to true to allow turnOff to be called
      act(() => {
        resultNullStream.rerender({ stream: null as any, onError, defaultOnState: true });
      });
      // Need to simulate the hook being in an "on" state to call turnOff
      // This is tricky with how result.current[1] is structured.
      // A better approach would be to have separate turnOn and turnOff functions returned.
      // For now, we assume the hook is 'on' and turnOff is called.
      // This test highlights a limitation in testing the toggle if stream becomes null post-initialization.

      // Let's reset and test turnOff directly with a null stream after being "on" conceptually
      const { result: turnOffTest, rerender } = renderHook(
        (props: { stream: MediaStream | null, initialOn: boolean }) => useTorchLight(props.stream, { onError }),
        { initialProps: { stream: mockStream, initialOn: false } }
      );
      // Turn on
      await act(async () => { await turnOffTest.current[1](); });
      expect(turnOffTest.current[0]).toBe(true);
      
      // Set stream to null
      rerender({ stream: null, initialOn: turnOffTest.current[0] });

      await act(async () => { await turnOffTest.current[1](); }); // Attempt to turn off

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onError.mock.calls[0][0].message).toContain('Stream is not available or invalid');
      // State should be false because setOn(false) is in finally
      expect(turnOffTest.current[0]).toBe(false);
    });

    it('should call onError if track.applyConstraints rejects for turnOff, but still set to off', async () => {
      mockGetCapabilities.mockReturnValue({ torch: true }); // Turn on via getCapabilities
      const onError = jest.fn();
      const { result } = renderHook(() => useTorchLight(mockStream, { onError }));

      // Turn on
      await act(async () => {
        await result.current[1]();
      });
      expect(result.current[0]).toBe(true);

      // Configure applyConstraints to fail for turnOff
      const turnOffError = new Error('TurnOffConstraintFailed');
      mockApplyConstraints.mockReset(); // Clear previous calls
      mockApplyConstraints.mockRejectedValueOnce(turnOffError);

      // Turn off
      await act(async () => {
        await result.current[1]();
      });
      expect(result.current[0]).toBe(false); // setOn(false) in finally block
      expect(onError).toHaveBeenCalledWith(turnOffError);
    });
  });

  // 4. Callbacks
  describe('Callbacks', () => {
    it('should not call onSuccess or onError if not provided', async () => {
      mockGetCapabilities.mockReturnValue({ torch: true });
      const { result } = renderHook(() => useTorchLight(mockStream)); // No callbacks

      await act(async () => {
        await result.current[1](); // Turn on
      });
      expect(result.current[0]).toBe(true);
      await act(async () => {
        await result.current[1](); // Turn off
      });
      expect(result.current[0]).toBe(false);
      // No explicit assertion for not calling, absence of error is the test

      // Test error path
      mockApplyConstraints.mockReset();
      mockApplyConstraints.mockRejectedValue(new Error("Failure"));
      mockGetCapabilities.mockReturnValue({ torch: false }); // Ensure it tries a path that fails
       (global as any).ImageCapture = undefined; // Ensure fallback is tried

      const { result: resultError } = renderHook(() => useTorchLight(mockStream));
      await act(async () => {
        await resultError.current[1](); // Turn on (will fail)
      });
      expect(resultError.current[0]).toBe(false);
       // No explicit assertion for not calling, absence of error is the test
    });
  });

  // 5. Debug Logging
  describe('Debug Logging', () => {
    it('should call log with messages when debug: true', async () => {
      mockGetCapabilities.mockReturnValue({ torch: true });
      const { result } = renderHook(() => useTorchLight(mockStream, { debug: true }));

      await act(async () => {
        await result.current[1](); // Turn on
      });
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Attempting to turn on torch using track.getCapabilities()'), 'blue', { debug: true });
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Torch turned on successfully using track.getCapabilities()'), 'green', { debug: true });
      logSpy.mockClear();

      await act(async () => {
        await result.current[1](); // Turn off
      });
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Attempting to turn off torch'), 'blue', { debug: true });
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Torch turned off successfully'), 'green', { debug: true });
    });

     it('should not call log when debug: false (or undefined)', async () => {
      mockGetCapabilities.mockReturnValue({ torch: true });
      const { result } = renderHook(() => useTorchLight(mockStream, { debug: false }));
      await act(async () => { await result.current[1](); }); // on
      await act(async () => { await result.current[1](); }); // off
      
      // Check if log was called with the debug:true object which it shouldn't
      logSpy.mock.calls.forEach(call => {
        if (call[2] && typeof call[2] === 'object') {
          expect((call[2] as any).debug).toBe(false);
        }
      });
      // More robust: ensure no logs with specific messages were made for debug
      expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('Attempting to turn on'), 'blue', { debug: true });
    });
  });
  
  // Method existence checks
  describe('Method Existence Safeguards', () => {
    it('should proceed to ImageCapture if getCapabilities is not a function', async () => {
      (mockTrack as any).getCapabilities = undefined; // Simulate getCapabilities not existing
      mockGetPhotoCapabilities.mockResolvedValue({ fillLightMode: ['flash'] }); // ImageCapture path works
      const { result } = renderHook(() => useTorchLight(mockStream, { debug: true }));

      await act(async () => { await result.current[1](); });
      expect(result.current[0]).toBe(true);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('track.getCapabilities() is not a function'), 'yellow', { debug: true });
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Attempting to turn on torch using ImageCapture API'), 'blue', { debug: true });
    });

    it('should proceed to fallback if ImageCapture is not a function', async () => {
      mockGetCapabilities.mockReturnValue({ torch: false }); // getCapabilities fails
      (global as any).ImageCapture = undefined; // ImageCapture constructor is undefined
      const { result } = renderHook(() => useTorchLight(mockStream, { debug: true }));

      await act(async () => { await result.current[1](); });
      expect(result.current[0]).toBe(true); // Fallback should work
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('window.ImageCapture is not a function'), 'yellow', { debug: true });
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Attempting to turn on torch using fallback applyConstraints'), 'blue', { debug: true });

    });

    it('should call onError if applyConstraints is not a function on any path', async () => {
      (mockTrack as any).applyConstraints = undefined;
      mockGetCapabilities.mockReturnValue({ torch: true }); // Path 1
      const onError = jest.fn();
      const { result } = renderHook(() => useTorchLight(mockStream, { onError, debug: true }));
      
      await act(async () => { await result.current[1](); });
      expect(result.current[0]).toBe(false);
      expect(onError).toHaveBeenCalledWith(new Error('track.applyConstraints is not a function.'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('track.applyConstraints() is not a function'), 'yellow', {debug: true});
    });
  });
});
