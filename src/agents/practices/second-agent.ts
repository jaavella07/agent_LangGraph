import { END, START, StateGraph, Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "langchain";

// Define el estado extendiendo MessagesAnnotation
const StateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  customer_name: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
  my_age: Annotation<number | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
});

type State = typeof StateAnnotation.State;

const model = new ChatOpenAI({ model: "gpt-4o-mini" });

async function nodeOne(state: State): Promise<Partial<State>> {
  const newState: Partial<State> = {};

  if (state.customer_name === undefined) {
    newState.customer_name = "John Doe";
  } else {
    newState.my_age = Math.floor(Math.random() * (30 - 20 + 1)) + 20;
  }

  // const history = state.messages;
  const history =
    state.messages.length > 0
      ? state.messages
      : [new HumanMessage("Hello")];
      
  const aiMessage = await model.invoke(history);
  newState.messages = [aiMessage];

  return newState;
}

const builder = new StateGraph(StateAnnotation)
  .addNode("node_one", nodeOne)
  .addEdge(START, "node_one")
  .addEdge("node_one", END);

export const secondAgent = builder.compile();





