import type { BuilderInput } from "./builder.js";
import type { PriorityWeights } from "@rotavise/contracts";
export type BuilderProps = {
  input: BuilderInput;
  onChange: (input: BuilderInput) => void;
  applied?: PriorityWeights;
};
