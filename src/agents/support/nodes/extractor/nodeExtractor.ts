import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "langchain";
import z from "zod";

import { StateAnnotation } from "../../state";
import { SYSTEM_PROMPT } from "./prompt";

type State = typeof StateAnnotation.State;

const ContactInfoSchema = z.object({
    name: z.string().describe("The name of the person"),
    email: z.string().describe("The email address of the person"),
    phone: z.string().describe("The phone number of the person"),
    age: z.number().describe("The age of the person"),
});

const llm = new ChatOpenAI({ model: "gpt-4o-mini" });

const structuredLlm = llm.withStructuredOutput(
    ContactInfoSchema,
    { name: "ContactInfo" }
);

async function extractor(state: State): Promise<Partial<State>> {
    const newState: Partial<State> = {};

    const history = state.messages;
    const customerName = state.customer_name;

  if (customerName == null || history.length >= 10) {
    const schema = await structuredLlm.invoke([
      new SystemMessage(SYSTEM_PROMPT),
      ...history,
    ]);
        newState.customer_name = schema.name;
        newState.phone_number = schema.phone;
        newState.my_age = schema.age;
    }

    return newState;
}

export { extractor };