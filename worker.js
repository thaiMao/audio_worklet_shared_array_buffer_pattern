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
const STATE = {
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
function processKernel() {}

/**
 * Sleep until it's time to wake up, then process audio data to fill up outputRingBuffer
 */
function waitOnRenderRequest() {}

/**
 * Initialise Worker
 */
function initialise() {}
