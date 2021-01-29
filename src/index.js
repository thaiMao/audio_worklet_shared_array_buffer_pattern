const { SharedBufferWorkletNode } = require("./audio-worklet-node");

function handleClick() {
  const context = new AudioContext();

  context.audioWorklet.addModule("src/audio-worklet-processor.js").then(() => {
    const oscillator = new OscillatorNode(context);

    const sbwNode = new SharedBufferWorkletNode(context);

    sbwNode.onInitialized = () => {
      oscillator.connect(sbwNode).connect(context.destination);

      oscillator.start();
    };

    sbwNode.onError = (errorData) => {
      logger.post("[ERROR] " + errorData.detail);
    };
  });
}

const btnElement = document.getElementById("btn");

btnElement.onclick = handleClick;
