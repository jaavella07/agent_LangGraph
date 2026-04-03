import { StateGraph, START, END } from "@langchain/langgraph";
import { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";
import { MemorySaver } from "@langchain/langgraph";

import { booking, conversation, extractor } from "./nodes";
import { intentRoute } from "./router";
import { StateAnnotation } from "./state";

type State = typeof StateAnnotation.State;

// ReactAgent al estado del grafo padre
async function bookingNode(state: State): Promise<Partial<State>> {
  const result = await booking.invoke({
    messages: state.messages,
  });

  return {
    messages: result.messages,
  };
}


export function makeGraph(config?: { checkpointer?: BaseCheckpointSaver }) {
  const builder = new StateGraph(StateAnnotation)
    .addNode("conversation", conversation)
    .addNode("extractor", extractor)
    .addNode("booking", bookingNode)
    .addEdge(START, "extractor")
    .addConditionalEdges("extractor", intentRoute, {
      conversation: "conversation",
      booking: "booking",
    })
    .addEdge("conversation", END)
    .addEdge("booking", END);
    const ragAgent = builder.compile({ checkpointer: config?.checkpointer });

    return ragAgent;
  }

export const ragAgent = makeGraph({ checkpointer: new MemorySaver() });
