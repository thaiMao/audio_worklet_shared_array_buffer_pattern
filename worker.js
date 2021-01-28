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
