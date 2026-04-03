import { Annotation, MessagesAnnotation } from "@langchain/langgraph";


export const StateAnnotation = Annotation.Root({
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