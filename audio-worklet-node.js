class SharedBufferWorkletNode extends AudioWorkletNode {
  constructor(context, options) {
    super(context, "audio-worklet-processor", options);

    this._workerOptions =
      options && options.worker
        ? options.worker
        : { ringRufferLength: 3072, channelCount: 1 };

    // Instantate Worker
    this._worker = new Worker("worker.js");

    // Async messaging exchanges only called on initialisation.
    // After the initial setup, communication between Worker and
    // AudioWorkletProcessor happens vis SharedArrayBuffer
    this._worker.onmessage = this._onWorkerInitialized.bind(this);
    this.port.onmessage = this._onProcessorInitialized.bind(this);

    // Initialize the worker.
    this._worker.postMessage({
      message: "INITIALIZE_WORKER",
      options: {
        ringBufferLength: this._workerOptions.ringBufferLength,
        channelCount: this._workerOptions.channelCount,
      },
    });
  }

  _onWorkerInitialized(eventFromWorker) {}

  _onProcessorInitialized(eventFromProcessor) {}
}
