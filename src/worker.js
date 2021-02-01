/**
 * Worker is instantiated by AudioWorkletNode (in the main thread).
 *
 * SharedArrayBuffer allows for communication between Worker and the associated AudioWorkletProcessor (in the render thread),
 * to achieve low latency communication.
 *
 * 2 SharedArrayBuffers are created by Woker.
 *
 * One to track shared states (Int32Array)
 *
 * Another for audio content (Float32Array)
 *
 *
 * The Worker "wakes up" when REQUEST_RENDER is "on" and renders the audio data.
 *
 * The AudioWorkletProcessor tells Worker to "wake up and render" when the output SAB audio content ring buffer
 * is close to underflow, in other words AudioWorkletProcessor is running out of audio content to "pull" from output SAB.
 *
 *
 *
 */

// Indices for State SharedArrayBuffer
const STATE_INDICES = {
  // Flag for Atomics.wait() and Atomics.wake()
  REQUEST_RENDER: 0,

  // Available frames in Input SAB.
  IB_FRAMES_AVAILABLE: 1,

  // Read index of Input SAB.
  IB_READ_INDEX: 2,

  // Write index of Input SAB.
  IB_WRITE_INDEX: 3,

  // Available frames in Output SAB.
  OB_FRAMES_AVAILABLE: 4,

  // Read index of Output SAB.
  OB_READ_INDEX: 5,

  // Write index of Output SAB.
  OB_WRITE_INDEX: 6,

  // Size of Input and Output SAB.
  RING_BUFFER_LENGTH: 7,

  // Size of user-supplied processing callback.
  KERNEL_LENGTH: 8,
};

const WORKER_CONFIG = {
  bytesPerState: Int32Array.BYTES_PER_ELEMENT,
  bytesPerSample: Float32Array.BYTES_PER_ELEMENT,
  stateBufferLength: 16,
  ringRufferLength: 4096,
  kernelLength: 1024,
  channelCount: 1,
  waitTimeOut: 25000,
};

// Shared state between Worker and AudioWorkletProcessor
let states;

// Shared ring buffers between Worker and AWP
let inputRingBuffer;
let outputRingBuffer;

/**
 * Process audio data in ring buffer
 */
function processKernel() {
  let inputReadIndex = states[STATE_INDICES.IB_READ_INDEX];
  let outputWriteIndex = states[STATE_INDICES.OB_WRITE_INDEX];

  // processing kernel that clones audio data sample by sample

  for (let i = 0; i < WORKER_CONFIG.kernelLength; ++i) {
    for (let j = 0; j < inputRingBuffer.length; ++j) {
      const input = inputRingBuffer[j][inputReadIndex];

      // Overdrive
      const x = Math.abs(input);
      let y;

      if (0.0 < x && x < 0.333) {
        y = 2 * x;
      } else if (0.333 < x && x < 0.666) {
        let t = 2.0 - 3.0 * x;
        y = (3.0 - t * t) / 3.0;
      } else {
        y = x;
      }

      outputRingBuffer[j][outputWriteIndex] = y; // input; //

      if (outputWriteIndex++ === WORKER_CONFIG.ringBufferLength) {
        outputWriteIndex = 0;
      }
      if (inputReadIndex++ === WORKER_CONFIG.ringBufferLength) {
        inputReadIndex = 0;
      }
    }
  }

  states[STATE_INDICES.IB_READ_INDEX] = inputReadIndex;
  states[STATE_INDICES.OB_WRITE_INDEX] = outputWriteIndex;
}

/**
 * Sleep until it's time to wake up, then process audio data to fill up outputRingBuffer
 */
function waitOnRenderRequest() {
  // As long as |REQUEST_RENDER| is zero, keep waiting. (sleep)
  while (Atomics.wait(states, STATE_INDICES.REQUEST_RENDER, 0) === "ok") {
    processKernel();

    // Update the number of available frames in the buffer.
    states[STATE_INDICES.IB_FRAMES_AVAILABLE] -= WORKER_CONFIG.kernelLength;
    states[STATE_INDICES.OB_FRAMES_AVAILABLE] += WORKER_CONFIG.kernelLength;

    // Reset the request render bit, and wait again.
    Atomics.store(states, STATE_INDICES.REQUEST_RENDER, 0);
  }
}

/**
 * Initialize Worker
 */
function initialize(options) {
  if (options.ringBufferLength) {
    WORKER_CONFIG.ringBufferLength = options.ringBufferLength;
  }
  if (options.channelCount) {
    WORKER_CONFIG.channelCount = options.channelCount;
  }

  if (!self.SharedArrayBuffer) {
    postMessage({
      message: "WORKER_ERROR",
      detail: `SharedArrayBuffer is not supported in your browser. See
            https://developers.google.com/web/updates/2018/06/audio-worklet-design-pattern
            for more info.`,
    });
    return;
  }

  // Allocate SABs
  const sharedBuffers = {
    states: new SharedArrayBuffer(
      WORKER_CONFIG.stateBufferLength * WORKER_CONFIG.bytesPerState
    ),
    inputRingBuffer: new SharedArrayBuffer(
      WORKER_CONFIG.ringBufferLength *
        WORKER_CONFIG.channelCount *
        WORKER_CONFIG.bytesPerSample
    ),
    outputRingBuffer: new SharedArrayBuffer(
      WORKER_CONFIG.ringBufferLength *
        WORKER_CONFIG.channelCount *
        WORKER_CONFIG.bytesPerSample
    ),
  };

  states = new Int32Array(sharedBuffers.states);
  inputRingBuffer = [new Float32Array(sharedBuffers.inputRingBuffer)];
  outputRingBuffer = [new Float32Array(sharedBuffers.outputRingBuffer)];

  // Initalise states buffer
  Atomics.store(
    states,
    STATE_INDICES.RING_BUFFER_LENGTH,
    WORKER_CONFIG.ringBufferLength
  );
  Atomics.store(
    states,
    STATE_INDICES.KERNEL_LENGTH,
    WORKER_CONFIG.kernelLength
  );

  // Notify AudioWorkletNode running in the main thread that Worker is ready
  postMessage({
    message: "WORKER_READY",
    sharedBuffers,
  });

  // Start waiting
  waitOnRenderRequest();
}

onmessage = (eventFromMain) => {
  if (eventFromMain.data.message != "INITIALIZE_WORKER") {
    console.log("[SharedBufferWorker] Unknown message: ", eventFromMain);
    return;
  }

  initialize(eventFromMain.data.options);
};
