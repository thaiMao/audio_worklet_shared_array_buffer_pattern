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

  _pushInputChannelData(inputChannelData) {
    let inputWriteIndex = this._states[STATE.IB_WRITE_INDEX];

    if (inputWriteIndex + inputChannelData.length < this._ringBufferLength) {
      // If the ring buffer has enough space to push the input.
      this._inputRingBuffer[0].set(inputChannelData, inputWriteIndex);
    } else {
      // When the ring buffer does not have enough space, the index needs to be wrapped around
      let splitIndex = this._ringBufferLength - inputWriteIndex;
      const firstHalf = inputChannelData.subArray(0, splitIndex);
      const secondHalf = inputChannelData.subArray(splitIndex);

      this._inputRingBuffer[0].set(firstHalf, inputWriteIndex);
      this._inputRingBuffer[0].set(secondHalf);

      this._states[STATE.IB_WRITE_INDEX] = secondHalf.length;
    }

    // Update the number of available frames in the input ring buffer.
    this._states[STATE.IB_FRAMES_AVAILABLE] += inputChannelData.length;
  }

  _pullOutputChannelData(outputChannelData) {}

  process() {
    return true;
  }
}

registerProcessor("audio-worklet-processor", SharedBufferWorkletProcessor);
