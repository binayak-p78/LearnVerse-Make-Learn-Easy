import { Workbench } from "../Workbench";

export default function PDAPage() {
  return (
    <Workbench
      workspace="pda"
      kinds={["pda"]}
      module="pda"
      title="PDA Stack Simulator"
      description="Transitions read a, pop X and push Y (written a, X → Y). The leftmost pushed symbol ends up on top. ε means nothing."
    />
  );
}
