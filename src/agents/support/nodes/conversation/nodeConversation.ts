import { ChatOpenAI } from "@langchain/openai";

import { HumanMessage } from "langchain";
import { StateAnnotation } from "../../state";
import { toolsIA } from "./toolsConversation";
import { SYSTEM_PROMPT } from "./prompt";

type State = typeof StateAnnotation.State;

const model = new ChatOpenAI({ model: "gpt-4o-mini" });
const modelWithTools = model.bindTools([toolsIA[0]]);


async function conversation(state: State): Promise<Partial<State>> {
  const newState: Partial<State> = {};
  const history = state.messages;
  const lastMessage = history[history.length - 1];
  const customerName = state.customer_name ?? "Jorge Avella";


  const userMessage = new HumanMessage(lastMessage.text);

  const aiMessage = await modelWithTools.invoke([SYSTEM_PROMPT, userMessage]);
  newState.messages = [aiMessage];

  return newState;
}

export { conversation };