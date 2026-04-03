import {Annotation,MessagesAnnotation, StateGraph,START,END, Send} from "@langchain/langgraph";


const StateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  nodes: Annotation<string[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
});

type State = typeof StateAnnotation.State;


function orchestrator(state: State): Partial<State> {
  const allNodes = ["node_1", "node_2", "node_3"];

  // Selección aleatoria de 1 a 3 nodos sin repetición
  const shuffled = allNodes.sort(() => Math.random() - 0.5);
  const count = Math.floor(Math.random() * 3) + 1;
  const nodes = shuffled.slice(0, count);

  console.log("Nodos seleccionados:", nodes);
  return { nodes };
}

function node1(state: State): Partial<State> { return state; }
function node2(state: State): Partial<State> { return state; }
function node3(state: State): Partial<State> { return state; }
function aggregator(state: State): Partial<State> { return state; }


function assignNodes(state: State): Send[] {
  return state.nodes.map((node) => new Send(node, {}));
}


const builder = new StateGraph(StateAnnotation)
  .addNode("orchestrator", orchestrator)
  .addNode("node_1", node1)
  .addNode("node_2", node2)
  .addNode("node_3", node3)
  .addNode("aggregator", aggregator)
  .addEdge(START, "orchestrator")
  // Send despacha dinámicamente a los nodos seleccionados en paralelo
  .addConditionalEdges("orchestrator", assignNodes, [
    "node_1",
    "node_2",
    "node_3",
  ])
  .addEdge("node_1", "aggregator")
  .addEdge("node_2", "aggregator")
  .addEdge("node_3", "aggregator")
  .addEdge("aggregator", END);

export const orchestrator_agent = builder.compile();
