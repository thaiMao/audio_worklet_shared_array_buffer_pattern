const STATE = {
  REQUEST_RENDER: 0,
  IB_FRAMES_AVAILABLE: 1,
  IB_READ_INDEX: 2,
  IB_WRITE_INDEX: 3,
  OB_FRAMES_AVAILABLE: 4,
  OB_READ_INDEX: 5,
  OB_WRITE_INDEX: 6,
  RING_BUFFER_LENGTH: 7,
  KERNEL_LENGTH: 8,
};

class SharedBufferWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this._initialized = false;
    this.port.message = this._initialisedEvent.bind(this);
  }

  _initialisedEvent(eventFromWorker) {
    const sharedBuffers = eventFromWorker.data;

    // Get the states buffer
    this._states = new Int32Array(sharedBuffers.states);

    // Worker's input/output buffers. This example only handles mono channel
    // for both.
    this._inputRingBuffer = [new Float32Array(sharedBuffers.inputRingBuffer)];
    this._outputRingBuffer = [new Float32Array(sharedBuffers.outputRingBuffer)];

    this._ringBufferLength = this._states[STATE.RING_BUFFER_LENGTH];
    this._kernelLength = this._states[STATE.KERNEL_LENGTH];

    this._initialized = true;
    this.port.postMessage({
      message: "PROCESSOR_READY",
    });
  }

  _pushInputChannelData(inputChannelData) {}

  _pullOutputChannelData(outputChannelData) {}

  process() {
    return true;
  }
}

registerProcessor("audio-worklet-processor", SharedBufferWorkletProcessor);
