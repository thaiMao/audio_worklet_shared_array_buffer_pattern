import Worker from "worker-loader!./worker";

interface WorkerConfig {
  bytesPerState?: number;
  bytesPerSample?: number;
  stateBufferLength?: number;
  ringBufferLength?: number;
  kernelLength?: number;
  channelCount?: number;
  waitTimeOut?: number;
}

interface WorkerMessageEvent extends MessageEvent {
  data: {
    sharedBuffers?: {
      states: SharedArrayBuffer;
      inputRingBuffer: SharedArrayBuffer;
      outputRingBuffer: SharedArrayBuffer;
    };
    message: string;
    detail?: string;
  };
}

interface Options {
  worker?: WorkerConfig;
  onInitialized: () => void;
  onError: (message: string) => void;
}

class SharedBufferWorkletNode extends AudioWorkletNode {
  #workerOptions: WorkerConfig;
  #worker: Worker;
  #onInitialized;
  #onError;

  constructor(public context: AudioContext, options: Options) {
    super(context, "audio-worklet-processor");

    this.#onInitialized = options.onInitialized;
    this.#onError = options.onError;

    this.#workerOptions = options?.worker ?? {
      ringBufferLength: 3072,
      channelCount: 1,
    };

    // Instantate Worker
    this.#worker = new Worker();

    // Async messaging exchanges only called on initialisation.
    // After the initial setup, communication between Worker and
    // AudioWorkletProcessor happens vis SharedArrayBuffer
    this.#worker.onmessage = this.onWorkerInitialized.bind(this);
    this.port.onmessage = this.onProcessorInitialized.bind(this);
    debugger;
    // Initialize the worker.
    this.#worker.postMessage({
      message: "INITIALIZE_WORKER",
      options: {
        ringBufferLength: this.#workerOptions.ringBufferLength,
        channelCount: this.#workerOptions.channelCount,
      },
    });
  }

  private onWorkerInitialized(eventFromWorker: WorkerMessageEvent): void {
    const { data } = eventFromWorker;

    if (data.message === "WORKER_READY") {
      // Send SharedArrayBuffers to the AudioWorkletProcessor
      console.log("Worker ready");
      this.port.postMessage(data.sharedBuffers);
      return;
    }

    if (data.message === "WORKER_ERROR") {
      console.log("[SharedBufferWorklet] Worker Error:", data.detail);
      if (typeof (this as any).onError === "function") {
        this.#onError(data.detail ?? "Some error");
      }
      return;
    }

    console.log("[SharedBufferWorklet] Unknown message: ", eventFromWorker);
  }

  private onProcessorInitialized(eventFromProcessor: MessageEvent): void {
    const data = eventFromProcessor.data;
    if (
      data.message === "PROCESSOR_READY" &&
      typeof (this as any).onInitialized === "function"
    ) {
      this.#onInitialized();
      return;
    }

    console.log("[SharedBufferWorklet] Unknown message: ", eventFromProcessor);
  }
}

export default SharedBufferWorkletNode;
