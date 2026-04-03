import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";


const StateAnnotation = Annotation.Root({
  joke: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
  topic: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
  feedback: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
  is_funny: Annotation<boolean | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
});

type State = typeof StateAnnotation.State;


const FeedbackSchema = z.object({
  is_funny: z.boolean().describe(
    "Decide if the joke is funny or not. Return True if it is, False otherwise."
  ),
  feedback: z.string().describe(
    "If the joke is not funny, provide feedback on how to improve it."
  ),
});

const llm = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });

const llmEvaluator = llm.withStructuredOutput(FeedbackSchema, {
  name: "Feedback",
});

const SYSTEM_PROMPT = `
Un chiste gracioso debe ser mas de 2 parrafos.
`;

async function generatorNode(state: State): Promise<Partial<State>> {
  const { feedback, topic } = state;

  const prompt = feedback
    ? `Write a joke about ${topic} but take into account the feedback: ${feedback} respond in Spanish`
    : `Write a joke about ${topic} respond in Spanish`;

  const msg = await llm.invoke(prompt);
  return { joke: msg.text };
}


async function evaluatorNode(state: State): Promise<Partial<State>> {
  const { joke } = state;

  const schema = await llmEvaluator.invoke(
    `Grade the joke ${joke} with the following prompt: ${SYSTEM_PROMPT}`
  );

  return { is_funny: schema.is_funny, feedback: schema.feedback };
}


function routeEdge(state: State): "generator_node" | typeof END {
  const isFunny = state.is_funny ?? true;
  return isFunny ? END : "generator_node";
}


const builder = new StateGraph(StateAnnotation)
  .addNode("generator_node", generatorNode)
  .addNode("evaluator_node", evaluatorNode)

  .addEdge(START, "generator_node")
  .addEdge("generator_node", "evaluator_node")
  .addConditionalEdges("evaluator_node", routeEdge, {
    generator_node: "generator_node",
    [END]: END,
  });

export const evaluator_agent = builder.compile();
