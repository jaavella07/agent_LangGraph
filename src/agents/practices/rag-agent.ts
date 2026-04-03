import { END, START, StateGraph, Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

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
    phone_number: Annotation<string | undefined>({
        reducer: (_, next) => next,
        default: () => undefined,
    }),
});

type State = typeof StateAnnotation.State;

const model = new ChatOpenAI({ model: "gpt-4o-mini" });

const fileSearchTool = {
    type: "file_search" as const,
    vector_store_ids: ["vs_69cc756a9338819188f6164a44826de2"],
};

const modelWithTools = model.bindTools([fileSearchTool]);

const ContactInfoSchema = z.object({
    name: z.string().describe("The name of the person"),
    email: z.string().describe("The email address of the person"),
    phone: z.string().describe("The phone number of the person"),
    age: z.number().describe("The age of the person"),
});

const llmWithStructuredOutput = new ChatOpenAI({ model: "gpt-4o-mini" });

const structuredLlm = llmWithStructuredOutput.withStructuredOutput(
    ContactInfoSchema,
    { name: "ContactInfo" }
);

// ─── Nodo extractor de información de contacto 

async function extractor(state: State): Promise<Partial<State>> {
    const newState: Partial<State> = {};

    const history = state.messages;
    const customerName = state.customer_name;

    if (customerName === undefined || history.length >= 10) {
        const schema = await structuredLlm.invoke(history);
        newState.customer_name = schema.name;
        newState.phone_number = schema.phone;
        newState.my_age = schema.age;
    }

    return newState;
}

// ─── Nodo de conversacion

async function conversation(state: State): Promise<Partial<State>> {
  const newState: Partial<State> = {};
  const history = state.messages;
  const lastMessage = history[history.length - 1];
  const customerName = state.customer_name ?? "Jorge Avella";

  const systemMessage = new SystemMessage(
    `You are a very helpful assistant who can answer questions from the customer ${customerName}; do not make up information—use only the information provided by the user.`
  );
  const userMessage = new HumanMessage(lastMessage.text);

  const aiMessage = await model.invoke([systemMessage, userMessage]);
  newState.messages = [aiMessage];

  return newState;
}

// ─── Grafo de estados

const builder = new StateGraph(StateAnnotation)

    .addNode("conversation", conversation)
    .addNode("extractor", extractor)
    .addEdge(START, "extractor")
    .addEdge("extractor", "conversation")
    .addEdge("conversation", END);

export const rag = builder.compile();





