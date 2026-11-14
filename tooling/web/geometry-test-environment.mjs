import { TestEnvironment } from "../../apps/web/node_modules/jest-environment-jsdom/build/index.js";
// jsdom supplies DOM APIs but omits Fetch and stream APIs used by the real
// browser unzip parser. Use Node's native implementations for this suite.
export default class GeometryEnvironment extends TestEnvironment {
  constructor(config, context) {
    super(config, context);
    for (const name of [
      "Response",
      "Request",
      "Headers",
      "Blob",
      "ReadableStream",
      "WritableStream",
      "TransformStream",
      "DecompressionStream",
    ])
      this.global[name] = globalThis[name];
  }
}
