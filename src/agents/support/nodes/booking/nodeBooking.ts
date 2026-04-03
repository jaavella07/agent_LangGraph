import { ChatOpenAI } from "@langchain/openai";
import { createAgent} from "langchain";

import { toolsBooking } from "./toolsBooking";
import { systemMessage } from "./prompt";

const llm = new ChatOpenAI({ model: "gpt-4o-mini" });

export const booking = createAgent({
  model: llm,
  tools: [toolsBooking[0]],
  systemPrompt: systemMessage,
});