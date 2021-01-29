const path = require("path");
module.exports = {
  entry: "./src/audio-worklet-node.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "index.js",
  },
  mode: "development",
};
