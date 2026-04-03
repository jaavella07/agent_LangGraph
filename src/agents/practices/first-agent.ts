import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createReactAgent } from "@langchain/langgraph/prebuilt";


const model = new ChatOpenAI({ model: "gpt-4o-mini" });

const weatherTool = tool(async ({ city }) => `Sunny in ${city}`, {
  name: "get_weather",
  schema: z.object({ city: z.string() }),
});

// Esto es lo que el CLI importa
export const firstAgent = createReactAgent({
  llm: model,
  tools: [weatherTool],
});