import { Workbench } from "../Workbench";

export default function TuringPage() {
  return (
    <Workbench
      workspace="tm"
      kinds={["tm"]}
      module="turing"
      title="Turing Machine Simulator"
      description="A deterministic single-tape machine. Each rule reads a symbol, writes one, and moves the head L, R or S (stay). It halts on entering an accept state."
    />
  );
}
