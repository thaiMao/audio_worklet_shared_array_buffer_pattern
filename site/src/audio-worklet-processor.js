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
    this.port.onmessage = this._initialisedEvent.bind(this);
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
      this._states[STATE.IB_WRITE_INDEX] += inputChannelData.length;
    } else {
      // When the ring buffer does not have enough space, the index needs to be wrapped around
      let splitIndex = this._ringBufferLength - inputWriteIndex;
      const firstHalf = inputChannelData.subarray(0, splitIndex);
      const secondHalf = inputChannelData.subarray(splitIndex);

      this._inputRingBuffer[0].set(firstHalf, inputWriteIndex);

      this._inputRingBuffer[0].set(secondHalf);

      this._states[STATE.IB_WRITE_INDEX] = secondHalf.length;
    }

    // Update the number of available frames in the input ring buffer.
    this._states[STATE.IB_FRAMES_AVAILABLE] += inputChannelData.length;
  }

  /**
   * Pull the data out of the shared output buffer to fill outputChannelData
   */
  _pullOutputChannelData(outputChannelData) {
    const outputReadIndex = this._states[STATE.OB_READ_INDEX];
    const nextReadIndex = outputReadIndex + outputChannelData.length;

    if (nextReadIndex < this._ringBufferLength) {
      outputChannelData.set(
        this._outputRingBuffer[0].subarray(outputReadIndex, nextReadIndex)
      );
      this._states[STATE.OB_READ_INDEX] += outputChannelData.length;
    } else {
      let overflow = nextReadIndex - this._ringBufferLength;
      let firstHalf = this._outputRingBuffer[0].subarray(outputReadIndex);
      let secondHalf = this._outputRingBuffer[0].subarray(0, overflow);
      outputChannelData.set(firstHalf);
      outputChannelData.set(secondHalf, firstHalf.length);
      this._states[STATE.OB_READ_INDEX] = secondHalf.length;
    }
  }

  process(inputs, outputs) {
    if (!this._initialized) {
      return true;
    }

    // This example only handles mono channel.
    const inputChannelData = inputs[0][0];
    const outputChannelData = outputs[0][0];

    if (typeof inputChannelData === "undefined") return true;

    this._pushInputChannelData(inputChannelData);
    this._pullOutputChannelData(outputChannelData);

    if (this._states[STATE.IB_FRAMES_AVAILABLE] >= this._kernelLength) {
      // Now we have enough frames to process. Wake up the worker.
      Atomics.notify(this._states, STATE.REQUEST_RENDER, 1);
    }

    return true;
  }
}

registerProcessor("audio-worklet-processor", SharedBufferWorkletProcessor);
