import { Workbench } from "../Workbench";

export default function FiniteAutomataPage() {
  return (
    <Workbench
      workspace="finite"
      kinds={["dfa", "nfa"]}
      module="automata"
      title="DFA / NFA Simulator"
      description="Design a finite automaton, trace an input symbol by symbol, then convert an NFA to a DFA or minimize it."
    />
  );
}
