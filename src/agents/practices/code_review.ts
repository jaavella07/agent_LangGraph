import { Annotation, END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import z from "zod";

//AGENTE DE REVISIÓN DE CÓDIGOS EN PARALLELO

const llm = new ChatOpenAI({ model: "gpt-4o-mini" });

const SecurityReview = z.object({
    vulnerabilities: z.array(z.string()).describe("The vulnerabilities in the code"),
    riskLevel: z.string().describe("The risk level of the vulnerabilities"),
    suggestions: z.array(z.string()).describe("The suggestions for fixing the vulnerabilities"),
});


const MaintainabilityReview = z.object({
    concerns: z.array(z.string()).describe("The concerns in the code"),
    qualityScore: z.int().describe("The quality score of the code"),
    recommendations: z.array(z.string()).describe("The recommendations for improving the code"),
});

const StateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,

  code: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  security_review: Annotation<z.infer<typeof SecurityReview> | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  maintainability_review: Annotation<z.infer<typeof MaintainabilityReview> | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  final_review: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
});

type State = typeof StateAnnotation.State;

// Nodo: security_review 
async function securityReview(state: State): Promise<Partial<State>> {
  const code = state.code;
  const llmWithStructuredOutput = llm.withStructuredOutput(SecurityReview, {
    name: "SecurityReview",
  });

  const schema = await llmWithStructuredOutput.invoke([
    new SystemMessage("You are an expert in code security. Focus on identifying security vulnerabilities, injection risks, and authentication issues."),
    new HumanMessage(`Review this code: ${code}`),
  ]);

  return { security_review: schema };
}

// Nodo: maintainability_review 
async function maintainabilityReview(state: State): Promise<Partial<State>> {
  const code = state.code;
  const llmWithStructuredOutput = llm.withStructuredOutput(MaintainabilityReview, {
    name: "MaintainabilityReview",
  });

  const schema = await llmWithStructuredOutput.invoke([
    new SystemMessage("You are an expert in code quality. Focus on code structure, readability, and adherence to best practices."),
    new HumanMessage(`Review this code: ${code}`),
  ]);

  return { maintainability_review: schema };
}

// Nodo: aggregator
async function aggregator(state: State): Promise<Partial<State>> {
  const { security_review, maintainability_review } = state;

  const response = await llm.invoke([
    new SystemMessage("You are a technical lead summarizing multiple code reviews"),
    new HumanMessage(
      `Synthesize these code review results into a concise summary with key actions:
       Security review: ${JSON.stringify(security_review)}
       Maintainability review: ${JSON.stringify(maintainability_review)}`
    ),
  ]);

  return { final_review: response.text };
}

// Grafo 
const builder = new StateGraph(StateAnnotation)

  .addNode("securityReview", securityReview)
  .addNode("maintainabilityReview", maintainabilityReview)
  .addNode("aggregator", aggregator)

  .addEdge(START, "securityReview")
  .addEdge(START, "maintainabilityReview")

  .addEdge("securityReview", "aggregator")
  .addEdge("maintainabilityReview", "aggregator")
  .addEdge("aggregator", END);

export const code_review = builder.compile();