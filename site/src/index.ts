import SharedBufferWorkletNode from "./audio-worklet-node";
import * as Tone from "tone";

// import("hello-rust-dsp-fx").then((js) => {
//   js.greet("WebAssembly");
// });

let synth: any;

function handleMousedown() {
  const context = new AudioContext();

  Tone.setContext(context);

  context.audioWorklet
    .addModule("dist/audio-worklet-processor.js")
    .then(() => {
      synth = new Tone.Oscillator(400, "sine");

      const sbwNode = new SharedBufferWorkletNode(context, {
        onInitialized: () => {
          Tone.connect(synth, sbwNode);
          Tone.connect(sbwNode, context.destination);
          synth.start();
        },
        onError: (errorMessage: string) => {
          console.log(errorMessage);
        },
      });
    })
    .catch((e) => console.log(e));
}

const btnElement = document.getElementById("btn");

if (btnElement !== null) {
  btnElement.onmousedown = handleMousedown;

  btnElement.onmouseup = () => {
    //synth.stop();
  };
}
