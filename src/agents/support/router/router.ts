import { z } from "zod";
import { SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

import { ROUTER_PROMPT } from "./prompt";
import { StateAnnotation } from "../state";

type State = typeof StateAnnotation.State;

const RouteIntentSchema = z.object({
  step: z.enum(["conversation", "booking"]),
});

const baseLlm = new ChatOpenAI({ model: "gpt-4o-mini" });

const llm = baseLlm.withStructuredOutput(RouteIntentSchema, {
  name: "RouteIntent",
});


export async function intentRoute(state:State): Promise<"conversation" | "booking"> {
  const history = state.messages;

try {
    const schema = await llm.invoke([
      new SystemMessage(ROUTER_PROMPT),
      ...history,
    ]);

    return schema.step ?? "conversation";
  } catch {
    return "conversation";
  }
}