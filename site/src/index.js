const { SharedBufferWorkletNode } = require("./audio-worklet-node");

import("../node_modules/hello-rust-dsp-fx/hello_rust_dsp_fx.js").then((js) => {
  js.greet("WebAssembly");
});

let synth;

function handleMousedown() {
  const context = new AudioContext();

  Tone.context = context;

  context.audioWorklet.addModule("src/audio-worklet-processor.js").then(() => {
    synth = new Tone.Oscillator(400, "sine");

    const sbwNode = new SharedBufferWorkletNode(context);

    sbwNode.onInitialized = () => {
      Tone.connect(synth, sbwNode);
      Tone.connect(sbwNode, context.destination);
      synth.start();
    };

    sbwNode.onError = (errorData) => {
      logger.post("[ERROR] " + errorData.detail);
    };
  });
}

const btnElement = document.getElementById("btn");

btnElement.onmousedown = handleMousedown;

btnElement.onmouseup = () => {
  synth.stop();
};
