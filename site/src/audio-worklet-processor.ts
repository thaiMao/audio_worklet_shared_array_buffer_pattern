const STATE_INDICES = {
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

interface AudioWorkletProcessor {
  readonly port: MessagePort;
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}

declare var AudioWorkletProcessor: {
  prototype: AudioWorkletProcessor;
  new (options?: AudioWorkletNodeOptions): AudioWorkletProcessor;
};

declare function registerProcessor(
  name: string,
  processorCtor: (new (
    options?: AudioWorkletNodeOptions
  ) => AudioWorkletProcessor) & {
    parameterDescriptors?: AudioParamDescriptor[];
  }
): undefined;

interface WorkerEvent extends MessageEvent {
  data: {
    states: SharedArrayBuffer;
    inputRingBuffer: SharedArrayBuffer;
    outputRingBuffer: SharedArrayBuffer;
  };
}

class SharedBufferWorkletProcessor extends AudioWorkletProcessor {
  #initialized = false;
  #states: Int32Array | undefined;
  #inputRingBuffer: Array<Float32Array> | undefined;
  #outputRingBuffer: Array<Float32Array> | undefined;
  #ringBufferLength = 0;
  #kernelLength = 0;

  constructor() {
    super();
    this.port.onmessage = this.initializedEvent.bind(this);
  }

  private initializedEvent(eventFromWorker: WorkerEvent): void {
    const sharedBuffers = eventFromWorker.data;

    // Get the states buffer
    this.#states = new Int32Array(sharedBuffers.states);

    // Worker's input/output buffers. This example only handles mono channel
    // for both.
    this.#inputRingBuffer = [new Float32Array(sharedBuffers.inputRingBuffer)];
    this.#outputRingBuffer = [new Float32Array(sharedBuffers.outputRingBuffer)];

    this.#ringBufferLength = this.#states[STATE_INDICES.RING_BUFFER_LENGTH];
    this.#kernelLength = this.#states[STATE_INDICES.KERNEL_LENGTH];

    this.#initialized = true;

    this.port.postMessage({
      message: "PROCESSOR_READY",
    });
  }

  private pushInputChannelData(inputChannelData: Float32Array): void {
    if (!this.#states || !this.#inputRingBuffer) return;

    let inputWriteIndex = this.#states[STATE_INDICES.IB_WRITE_INDEX];

    if (inputWriteIndex + inputChannelData.length < this.#ringBufferLength) {
      // If the ring buffer has enough space to push the input.
      this.#inputRingBuffer[0].set(inputChannelData, inputWriteIndex);

      this.#states[STATE_INDICES.IB_WRITE_INDEX] += inputChannelData.length;
    } else {
      // When the ring buffer does not have enough space, the index needs to be wrapped around
      let splitIndex = this.#ringBufferLength - inputWriteIndex;
      const firstHalf = inputChannelData.subarray(0, splitIndex);
      const secondHalf = inputChannelData.subarray(splitIndex);

      this.#inputRingBuffer[0].set(firstHalf, inputWriteIndex);

      this.#inputRingBuffer[0].set(secondHalf);

      this.#states[STATE_INDICES.IB_WRITE_INDEX] = secondHalf.length;
    }

    // Update the number of available frames in the input ring buffer.
    this.#states[STATE_INDICES.IB_FRAMES_AVAILABLE] += inputChannelData.length;
  }

  /**
   * Pull the data out of the shared output buffer to fill outputChannelData
   */
  private pullOutputChannelData(outputChannelData: Float32Array): void {
    if (!this.#states || !this.#outputRingBuffer) return;

    const outputReadIndex = this.#states[STATE_INDICES.OB_READ_INDEX];
    const nextReadIndex = outputReadIndex + outputChannelData.length;

    if (nextReadIndex < this.#ringBufferLength) {
      outputChannelData.set(
        this.#outputRingBuffer[0].subarray(outputReadIndex, nextReadIndex)
      );
      this.#states[STATE_INDICES.OB_READ_INDEX] += outputChannelData.length;
    } else {
      let overflow = nextReadIndex - this.#ringBufferLength;
      let firstHalf = this.#outputRingBuffer[0].subarray(outputReadIndex);
      let secondHalf = this.#outputRingBuffer[0].subarray(0, overflow);
      outputChannelData.set(firstHalf);
      outputChannelData.set(secondHalf, firstHalf.length);
      this.#states[STATE_INDICES.OB_READ_INDEX] = secondHalf.length;
    }
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    if (!this.#initialized) {
      return true;
    }

    // This example only handles mono channel.
    const inputChannelData = inputs[0][0];
    const outputChannelData = outputs[0][0];

    if (typeof inputChannelData === "undefined") return true;

    this.pushInputChannelData(inputChannelData);
    this.pullOutputChannelData(outputChannelData);

    if (
      this.#states &&
      this.#states[STATE_INDICES.IB_FRAMES_AVAILABLE] >= this.#kernelLength
    ) {
      // Now we have enough frames to process. Wake up the worker.
      Atomics.notify(this.#states, STATE_INDICES.REQUEST_RENDER, 1);
    }

    return true;
  }
}

registerProcessor("audio-worklet-processor", SharedBufferWorkletProcessor);
