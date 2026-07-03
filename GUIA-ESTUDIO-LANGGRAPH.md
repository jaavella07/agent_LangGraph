# Guía de estudio: Agentes conversacionales con LangGraph + TypeScript

Ruta de aprendizaje progresiva para construir agentes conversacionales con [LangGraph JS](https://langchain-ai.github.io/langgraphjs/), basada en el código real de este repositorio. Cada fase tiene un **objetivo**, un **concepto clave**, código de ejemplo y la referencia al archivo del repo que lo implementa.

**Orden recomendado:** Fase 0 → 9, sin saltarse fases. Cada una construye sobre la anterior.

---

## Índice

| Fase | Tema | Archivo de referencia |
|------|------|----------------------|
| 0 | Fundamentos y vocabulario | — |
| 1 | Setup del proyecto | `package.json`, `tsconfig.json`, `langgraph.json` |
| 1B | Modelos locales con Ollama (sin API keys) | — |
| 1C | Agente básico sin tool calling (Nivel 0) | — (no existe en el repo, construido en esta guía) |
| 2 | Primer agente: ReAct + tools | `src/agents/practices/first-agent.ts` |
| 3 | StateGraph personalizado y estado | `src/agents/practices/second-agent.ts` |
| 4 | Salida estructurada y RAG | `src/agents/practices/rag-agent.ts` |
| 5 | Patrones de orquestación | `code_review.ts`, `orchestrator.ts`, `evaluator.ts` |
| 6 | Agente conversacional completo | `src/agents/support/` |
| 7 | Memoria persistente | `src/api/db.ts`, `docker-compose.yml` |
| 8 | Exponer el agente por API | `src/api/` |
| 9 | Ejecución, debugging y siguientes pasos | — |

---

## Fase 0 — Fundamentos

**Objetivo:** entender qué es LangGraph antes de escribir código.

LangGraph modela un agente como un **grafo de estados**: en lugar de una cadena lineal (prompt → LLM → respuesta), defines **nodos** (funciones que reciben el estado y devuelven una actualización parcial) conectados por **aristas** (fijas o condicionales). Esto permite ciclos, bifurcaciones, paralelismo y persistencia — cosas que una cadena lineal no puede hacer.

**Vocabulario esencial:**

- **`StateGraph`** — el constructor del grafo: nodos + aristas + estado compartido.
- **`Annotation` / `MessagesAnnotation`** — definición tipada del estado. `MessagesAnnotation` ya trae el campo `messages` con un reducer que acumula el historial de mensajes.
- **Reducer** — función que decide cómo se combina el valor nuevo de un campo con el anterior (ej: reemplazar vs. concatenar).
- **`START` / `END`** — nodos virtuales de entrada y salida del grafo.
- **Tool calling** — el LLM decide invocar funciones tuyas (definidas con esquemas `zod`).
- **Checkpointer** — mecanismo de persistencia del estado entre invocaciones (la "memoria").
- **`thread_id`** — identificador de conversación; cada thread tiene su propio estado persistido.

---

## Fase 1 — Setup del proyecto

**Objetivo:** dejar listo un proyecto TypeScript con LangGraph funcionando.

### 1.1 Crear el proyecto

```bash
mkdir mi-agente && cd mi-agente
npm init -y
```

Requisito: **Node 20+**.

### 1.2 Instalar TypeScript y herramientas

```bash
npm install -D typescript @types/node
npm install -D ts-node        # o mejor: tsx (más rápido, sin config)
```

### 1.3 Configurar `tsconfig.json`

El del repo ([tsconfig.json](tsconfig.json)):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

### 1.4 Instalar dependencias de LangGraph

```bash
# Núcleo
npm install @langchain/langgraph @langchain/core langchain zod

# Proveedor LLM (elige el tuyo)
npm install @langchain/openai        # gpt-4o-mini es el usado en este repo

# Variables de entorno
npm install dotenv
```

### 1.5 Variables de entorno

Crea `.env` (y un `.env.template` sin valores para el repo):

```bash
OPENAI_API_KEY=sk-...
DB_URI=postgresql://postgres:postgres@localhost:5432/agent
```

Cárgalas al inicio de tu entrypoint con:

```ts
import "dotenv/config";
```

### 1.6 Configurar `langgraph.json` (LangGraph Studio)

Registra tus grafos para visualizarlos y depurarlos con el CLI. El del repo ([langgraph.json](langgraph.json)):

```json
{
  "node_version": "20",
  "graphs": {
    "agent":  "./src/agents/practices/first-agent.ts:firstAgent",
    "support": "./src/agents/support/agent.ts:ragAgent"
  },
  "env": ".env"
}
```

El formato es `"nombre": "./ruta/al/archivo.ts:exportDelGrafoCompilado"`.

```bash
npx @langchain/langgraph-cli dev   # abre LangGraph Studio en el navegador
```

### 1.7 Estructura de carpetas recomendada (la de este repo)

```
mi-agente/
├── .env / .env.template
├── langgraph.json
├── docker-compose.yml        # Postgres para memoria (Fase 7)
├── package.json / tsconfig.json
├── notebooks/                # experimentos sueltos
└── src/
    ├── main.ts               # entrypoint
    ├── api/                  # capa HTTP (Fase 8)
    │   ├── server.ts
    │   ├── db.ts
    │   └── routes/chat.ts
    └── agents/
        ├── practices/        # ejercicios por patrón (Fases 2-5)
        └── support/          # agente capstone (Fase 6)
            ├── agent.ts / state.ts
            ├── router/
            └── nodes/{extractor,conversation,booking}/
```

✅ **Antes de avanzar deberías poder:** ejecutar `npx tsx src/main.ts` sin errores y ver tus grafos en LangGraph Studio.

---

## Fase 1B — Modelos locales con Ollama (evitar pagar API keys)

**Objetivo:** ejecutar los mismos agentes de este repo contra un modelo que corre en tu propia máquina, sin depender de `OPENAI_API_KEY` ni de costo por token. Esta fase es **opcional** y se puede aplicar en cualquier momento a partir de la Fase 2 — cambia el proveedor del LLM, no la lógica de los grafos.

**Concepto clave:** [Ollama](https://ollama.com) es un runtime que descarga y sirve LLMs open-weight (Llama, Qwen, Mistral, etc.) localmente vía una API HTTP en `http://localhost:11434`. El paquete `@langchain/ollama` expone `ChatOllama`, que implementa el mismo contrato que `ChatOpenAI` — en la mayoría de nodos de este repo es un reemplazo directo, solo cambiando el import y el constructor.

### 1B.1 Instalar Ollama

- **Windows / macOS:** descarga el instalador desde https://ollama.com/download y ejecútalo. Queda corriendo como servicio en segundo plano (`ollama serve`).
- **macOS con Homebrew:** `brew install ollama`
- **Linux:** `curl -fsSL https://ollama.com/install.sh | sh`

Verifica que el servicio está arriba:

```bash
ollama --version
ollama list          # modelos descargados (vacío la primera vez)
```

### 1B.2 Descargar un modelo con soporte de tool calling

Este repo usa `tool calling` y `withStructuredOutput` en casi todas las fases (2, 4, 5, 6), así que elige un modelo certificado para eso — no todos los modelos de Ollama lo soportan bien:

```bash
ollama pull llama3.1        # 8B, buen equilibrio calidad/velocidad, soporta tools
# alternativas: qwen2.5, mistral-nemo, firefunction-v2
```

Hardware orientativo: ~8 GB de RAM libres para un modelo de 8B en cuantización por defecto (con GPU/VRAM dedicada corre más rápido, pero no es obligatorio).

Pruébalo desde la terminal antes de tocar código:

```bash
ollama run llama3.1
>>> Hola, preséntate en una frase.
```

### 1B.3 Instalar el paquete de LangChain para Ollama

```bash
npm install @langchain/ollama
```

### 1B.4 Reemplazar el proveedor en el código

Cualquier `new ChatOpenAI({ model: "gpt-4o-mini" })` de este repo se cambia por:

```ts
import { ChatOllama } from "@langchain/ollama";

const model = new ChatOllama({
  model: "llama3.1",
  baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434", // valor por defecto
});
```

Ejemplo aplicado a [first-agent.ts](src/agents/practices/first-agent.ts) (Fase 2), sin ninguna API key configurada:

```ts
import { ChatOllama } from "@langchain/ollama";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

const model = new ChatOllama({ model: "llama3.1" });

const weatherTool = tool(async ({ city }) => `Sunny in ${city}`, {
  name: "get_weather",
  schema: z.object({ city: z.string() }),
});

export const firstAgent = createReactAgent({ llm: model, tools: [weatherTool] });
```

### 1B.5 Variable de entorno opcional

```bash
# .env
OLLAMA_BASE_URL=http://localhost:11434
```

### 1B.6 Elegir el proveedor dinámicamente (opcional)

`langchain` incluye `initChatModel`, que resuelve el proveedor a partir de un string — útil para no hardcodear `ChatOpenAI` vs `ChatOllama` en cada archivo y alternar entre ambos con una variable de entorno:

```ts
import { initChatModel } from "langchain/chat_models/universal";

const model = await initChatModel(
  process.env.LLM_MODEL ?? "ollama:llama3.1"   // o "openai:gpt-4o-mini"
);
```

### 1B.7 Limitaciones a tener en cuenta

- **Salida estructurada y tool calling** dependen del modelo: modelos pequeños (<7B) suelen fallar esquemas zod con varios campos anidados (afecta el extractor de la Fase 4, los revisores de la Fase 5 y el router de la Fase 6). Empieza con `llama3.1:8b` o `qwen2.5:7b` antes de probar modelos más chicos.
- **`file_search`** (Fase 4) es una tool nativa de OpenAI — no existe en Ollama; para RAG local necesitarías tu propio retriever (embeddings + vector store) en vez de esa tool.
- **Velocidad:** sin GPU la latencia por respuesta es notablemente mayor que con la API de OpenAI — aceptable para estudio, no ideal para producción con mucha concurrencia.
- Puedes **mezclar proveedores** dentro del mismo grafo: por ejemplo `ChatOllama` en el nodo de conversación simple y `ChatOpenAI` solo donde necesites `file_search`.

✅ **Antes de avanzar deberías poder:** correr `first-agent.ts` (Fase 2) usando `ChatOllama` en vez de `ChatOpenAI`, sin ninguna API key configurada, y explicar en qué fases del repo podría fallar un modelo local pequeño.

---

## Fase 1C — Agente básico sin tool calling (Nivel 0)

> 📌 Este apartado **no existe en el repo actual** — se construye aquí desde cero como escalón didáctico. Es el punto de partida más simple posible y la opción que sigue funcionando incluso cuando el modelo (por ejemplo, un modelo pequeño de Ollama) **no soporta tool calling** — la limitación que se menciona en 1B.7.

**Objetivo:** construir el agente conversacional más simple posible — sin `bindTools`, sin `withStructuredOutput`, sin `createReactAgent` — para entender la base sobre la que se construye todo lo demás en esta guía.

**Concepto clave — niveles de capacidad de un agente:**

| Nivel | Capacidad | Requiere del modelo | Fase de esta guía |
|---|---|---|---|
| **0** | Conversación simple: prompt + historial → respuesta | Ninguna especial (cualquier LLM, incluso muy pequeño) | **Esta fase** |
| 1 | Tool calling nativo: el modelo decide llamar funciones | Soporte de function/tool calling | Fase 2 |
| 2 | Salida estructurada, extracción, RAG | Tool calling + JSON schema | Fase 4 |
| 3 | Orquestación multi-nodo, paralelismo, ciclos | — | Fase 5 |
| 4 | Multi-agente, memoria persistente, API | — | Fases 6-8 |

Un agente de **Nivel 0** no toma decisiones ni actúa sobre el mundo — es un chatbot con estado. Pero es la base real: cada nodo de este repo que hace `model.invoke(mensajes)` sin tools (por ejemplo, el nodo `conversation` de la Fase 6) es, en el fondo, un paso de Nivel 0.

### 1C.1 El grafo mínimo: un nodo, sin tools

```ts
import { END, START, StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

// Nivel 0: MessagesAnnotation ya trae lo necesario, no hace falta extender el estado
const model = new ChatOpenAI({ model: "gpt-4o-mini" });
// o const model = new ChatOllama({ model: "llama3.2" }); — sirve igual, ningún modelo
// necesita soportar tool calling para este nodo

const SYSTEM_PROMPT = "Eres un asistente breve y directo. Responde siempre en español.";

async function chatNode(state: typeof MessagesAnnotation.State) {
  const response = await model.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    ...state.messages,
  ]);
  return { messages: [response] };
}

const builder = new StateGraph(MessagesAnnotation)
  .addNode("chat", chatNode)
  .addEdge(START, "chat")
  .addEdge("chat", END);

export const basicAgent = builder.compile();
```

Ejecutarlo:

```ts
const result = await basicAgent.invoke({
  messages: [{ role: "user", content: "¿Qué es LangGraph?" }],
});
console.log(result.messages.at(-1)?.content);
```

No hay `tool()`, no hay `zod`, no hay `bindTools`. Compáralo con [first-agent.ts](src/agents/practices/first-agent.ts) (Fase 2): la diferencia estructural es únicamente que allí `createReactAgent` arma el nodo internamente y sí registra tools.

### 1C.2 Memoria conversacional sin checkpointer

Antes de llegar al checkpointer real (Fase 7), la forma más simple de "recordar" es acumular el historial en una variable del proceso y volver a invocar el grafo con él completo:

```ts
import { BaseMessage, HumanMessage } from "@langchain/core/messages";

let history: BaseMessage[] = [];

async function ask(question: string) {
  history.push(new HumanMessage(question));
  const result = await basicAgent.invoke({ messages: history });
  history = result.messages;
  return history.at(-1)?.content;
}
```

Es memoria "manual" en RAM del proceso — se pierde al reiniciar. Es el escalón conceptual justo antes de `MemorySaver` / `PostgresSaver`.

### 1C.3 Simular "acciones" sin tool calling nativo (ReAct manual por texto)

Antes de que los LLMs soportaran tool calling nativo, el patrón ReAct se implementaba pidiéndole al modelo que **describiera en texto plano** la acción que quería ejecutar, y el código parseaba esa respuesta con una convención de formato. Es la técnica a usar cuando el modelo es de Nivel 0 (sin tool calling) pero igual necesitas que "actúe" — típico en modelos chicos de Ollama:

```ts
const REACT_PROMPT = `
Puedes responder directamente o pedir una acción. Si necesitas el clima de una ciudad,
responde EXACTAMENTE en este formato, sin nada más:
ACTION: get_weather(<ciudad>)

Si ya tienes la información para responder, responde normalmente en español.
`;

function parseAction(text: string): { tool: string; arg: string } | null {
  const match = text.match(/^ACTION:\s*(\w+)\((.+)\)$/);
  return match ? { tool: match[1], arg: match[2] } : null;
}

async function chatNode(state: typeof MessagesAnnotation.State) {
  const response = await model.invoke([
    new SystemMessage(REACT_PROMPT),
    ...state.messages,
  ]);

  const action = parseAction(String(response.content).trim());
  if (action?.tool === "get_weather") {
    const observation = `Sunny in ${action.arg}`; // aquí ejecutarías la función real

    // Reinyectamos la observación como si fuera el resultado de una tool call
    const finalResponse = await model.invoke([
      new SystemMessage(REACT_PROMPT),
      ...state.messages,
      response,
      new HumanMessage(`Resultado: ${observation}. Ahora responde al usuario.`),
    ]);
    return { messages: [response, finalResponse] };
  }

  return { messages: [response] };
}
```

Esto es, a mano, lo que `createReactAgent` (Fase 2) automatiza **cuando el modelo soporta tool calling nativo** — con la ventaja de que ahí el formato viene garantizado por un JSON schema en vez de depender de que el modelo respete al pie de la letra un formato de texto libre.

⚠️ **Por qué es frágil:** el modelo puede no seguir el formato exacto (agregar texto extra, cambiar mayúsculas, olvidar paréntesis), y el `regex` de `parseAction` fallará silenciosamente. Por eso este patrón casi no se usa con modelos grandes hoy — pero sigue siendo la única opción viable con:
- modelos muy pequeños de Ollama sin soporte de tools,
- proveedores que no exponen function calling,
- modelos legacy o fine-tunes propios.

### 1C.4 Cuándo subir al Nivel 1 (Fase 2)

En cuanto tu modelo soporte tool calling (revisa la ficha del modelo en Ollama, o usa cualquier modelo reciente de OpenAI/Anthropic), prefiere siempre `tool()` + `createReactAgent`/`bindTools` sobre el parseo manual: es más confiable, viene tipado con `zod`, y es exactamente lo que ya usa este repo desde la Fase 2 en adelante.

✅ **Antes de avanzar deberías poder:**
- Construir un grafo de un solo nodo que solo invoca al modelo, sin ninguna tool.
- Explicar la diferencia entre un agente de Nivel 0 (conversación) y uno de Nivel 1 (tool calling).
- Explicar por qué el parseo manual de acciones es más frágil que el tool calling nativo, y en qué casos igual es la única opción.

---

## Fase 2 — Primer agente: ReAct prebuilt + tools

**Objetivo:** tener un agente funcionando en ~15 líneas usando el patrón prebuilt.

**Concepto clave:** el patrón **ReAct** (Reason + Act): el LLM razona, decide si llamar una tool, observa el resultado y repite hasta poder responder. `createReactAgent` te da ese bucle ya armado.

Referencia: [src/agents/practices/first-agent.ts](src/agents/practices/first-agent.ts)

```ts
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

const model = new ChatOpenAI({ model: "gpt-4o-mini" });

// Una tool = función async + esquema zod que el LLM entiende
const weatherTool = tool(async ({ city }) => `Sunny in ${city}`, {
  name: "get_weather",
  schema: z.object({ city: z.string() }),
});

export const firstAgent = createReactAgent({
  llm: model,
  tools: [weatherTool],
});
```

✅ **Antes de avanzar deberías poder:** explicar qué pasa internamente cuando el usuario pregunta "¿qué clima hace en Bogotá?" (LLM → tool call → resultado → respuesta final).

---

## Fase 3 — StateGraph personalizado y estado

**Objetivo:** abandonar el prebuilt y construir tu propio grafo con estado a medida.

**Concepto clave:** el **estado** es un objeto tipado compartido por todos los nodos. Cada nodo devuelve un `Partial<State>` y LangGraph aplica los **reducers** para fusionarlo con el estado actual.

Referencia: [src/agents/practices/second-agent.ts](src/agents/practices/second-agent.ts)

```ts
import { END, START, StateGraph, Annotation, MessagesAnnotation } from "@langchain/langgraph";

// Extiende MessagesAnnotation con campos propios
const StateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,                    // messages (reducer acumulativo)
  customer_name: Annotation<string | undefined>({
    reducer: (_, next) => next,                  // reemplaza el valor anterior
    default: () => undefined,
  }),
});

type State = typeof StateAnnotation.State;

// Un nodo = función (state) => actualización parcial del estado
async function nodeOne(state: State): Promise<Partial<State>> {
  const aiMessage = await model.invoke(state.messages);
  return { customer_name: "John Doe", messages: [aiMessage] };
}

const builder = new StateGraph(StateAnnotation)
  .addNode("node_one", nodeOne)
  .addEdge(START, "node_one")
  .addEdge("node_one", END);

export const secondAgent = builder.compile();
```

**Puntos de estudio:**
- ¿Por qué `messages: [aiMessage]` **agrega** el mensaje en vez de reemplazar el historial? (Respuesta: el reducer de `MessagesAnnotation` concatena.)
- ¿Por qué `customer_name` sí se reemplaza? (Su reducer es `(_, next) => next`.)

✅ **Antes de avanzar deberías poder:** agregar un campo nuevo al estado con su propio reducer y usarlo desde un nodo.

---

## Fase 4 — Salida estructurada y RAG

**Objetivo:** extraer datos tipados de la conversación y responder con conocimiento externo.

**Concepto clave:** `withStructuredOutput(schema)` fuerza al LLM a devolver un objeto que cumple un esquema `zod` — la base de extractores, routers y evaluadores.

Referencia: [src/agents/practices/rag-agent.ts](src/agents/practices/rag-agent.ts)

### 4.1 Nodo extractor (salida estructurada)

```ts
const ContactInfoSchema = z.object({
  name:  z.string().describe("The name of the person"),
  email: z.string().describe("The email address of the person"),
  phone: z.string().describe("The phone number of the person"),
  age:   z.number().describe("The age of the person"),
});

const structuredLlm = new ChatOpenAI({ model: "gpt-4o-mini" })
  .withStructuredOutput(ContactInfoSchema, { name: "ContactInfo" });

async function extractor(state: State): Promise<Partial<State>> {
  // Solo extrae si aún no conocemos al cliente (evita llamadas innecesarias)
  if (state.customer_name === undefined || state.messages.length >= 10) {
    const schema = await structuredLlm.invoke(state.messages);
    return { customer_name: schema.name, phone_number: schema.phone };
  }
  return {};
}
```

### 4.2 Nodo de conversación con RAG (`file_search`)

```ts
// Tool nativa de OpenAI: busca en un vector store ya cargado
const fileSearchTool = {
  type: "file_search" as const,
  vector_store_ids: ["vs_..."],
};

const modelWithTools = model.bindTools([fileSearchTool]);
```

### 4.3 Pipeline secuencial

```ts
const builder = new StateGraph(StateAnnotation)
  .addNode("extractor", extractor)
  .addNode("conversation", conversation)
  .addEdge(START, "extractor")
  .addEdge("extractor", "conversation")
  .addEdge("conversation", END);
```

✅ **Antes de avanzar deberías poder:** escribir un esquema zod con `.describe()` en cada campo y explicar por qué las descripciones mejoran la extracción.

---

## Fase 5 — Patrones de orquestación

**Objetivo:** dominar las tres topologías de grafo más importantes más allá del pipeline lineal.

### 5.1 Fan-out / fan-in (paralelismo estático)

**Concepto clave:** varias aristas saliendo de `START` ejecutan nodos **en paralelo**; un nodo agregador espera a todos (map-reduce).

Referencia: [src/agents/practices/code_review.ts](src/agents/practices/code_review.ts) — dos revisores (seguridad y mantenibilidad, ambos con salida estructurada) corren en paralelo y un `aggregator` sintetiza.

```ts
const builder = new StateGraph(StateAnnotation)
  .addNode("securityReview", securityReview)
  .addNode("maintainabilityReview", maintainabilityReview)
  .addNode("aggregator", aggregator)
  .addEdge(START, "securityReview")          // ambos parten de START
  .addEdge(START, "maintainabilityReview")   // → se ejecutan en paralelo
  .addEdge("securityReview", "aggregator")
  .addEdge("maintainabilityReview", "aggregator")  // aggregator espera a ambos
  .addEdge("aggregator", END);
```

### 5.2 Despacho dinámico con `Send`

**Concepto clave:** cuando no sabes en compile-time cuántos nodos ejecutar, una arista condicional puede devolver objetos `Send` que despachan nodos dinámicamente en paralelo.

Referencia: [src/agents/practices/orchestrator.ts](src/agents/practices/orchestrator.ts)

```ts
import { Send } from "@langchain/langgraph";

function assignNodes(state: State): Send[] {
  return state.nodes.map((node) => new Send(node, {}));
}

builder.addConditionalEdges("orchestrator", assignNodes, ["node_1", "node_2", "node_3"]);
```

### 5.3 Bucle evaluador/optimizador (grafo cíclico)

**Concepto clave:** una arista condicional puede volver **hacia atrás**, creando un ciclo generar → evaluar → regenerar con feedback hasta cumplir un criterio.

Referencia: [src/agents/practices/evaluator.ts](src/agents/practices/evaluator.ts) — un generador escribe un chiste, un evaluador (salida estructurada `{ is_funny, feedback }`) lo califica y decide si repetir.

```ts
function routeEdge(state: State): "generator_node" | typeof END {
  return state.is_funny ? END : "generator_node";  // ciclo si no es gracioso
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
```

⚠️ Con ciclos, piensa siempre en la **condición de salida** (aquí `is_funny`); LangGraph además tiene un límite de recursión configurable como red de seguridad.

✅ **Antes de avanzar deberías poder:** dibujar en papel los tres grafos y decir cuándo usarías cada patrón.

---

## Fase 6 — Agente conversacional completo (capstone)

**Objetivo:** combinar todo lo anterior en un agente de soporte real: enrutamiento por intención, extracción de datos, conversación con tools y un sub-agente de reservas.

Referencia: [src/agents/support/](src/agents/support/)

### 6.1 Arquitectura

```
START → extractor → (router de intención) → conversation → END
                                          ↘ booking      → END
```

### 6.2 Estado compartido

[src/agents/support/state.ts](src/agents/support/state.ts) — `MessagesAnnotation` + `customer_name`, `my_age`, `phone_number`. Es el mismo patrón de la Fase 3, ahora en su propio módulo para compartirlo entre nodos.

### 6.3 Router de intención (arista condicional + salida estructurada)

[src/agents/support/router/router.ts](src/agents/support/router/router.ts) — un LLM con `withStructuredOutput` clasifica la intención. Nota el `try/catch` con fallback: si la clasificación falla, la conversación no se rompe.

```ts
const RouteIntentSchema = z.object({
  step: z.enum(["conversation", "booking"]),
});

export async function intentRoute(state: State): Promise<"conversation" | "booking"> {
  try {
    const schema = await llm.invoke([new SystemMessage(ROUTER_PROMPT), ...state.messages]);
    return schema.step ?? "conversation";
  } catch {
    return "conversation";   // fallback seguro
  }
}
```

### 6.4 Sub-agente ReAct como nodo (agente anidado)

[src/agents/support/nodes/booking/](src/agents/support/nodes/booking/) — el nodo `booking` es un agente ReAct completo (`createAgent` de `langchain`) con tools de reserva ([toolsBooking.ts](src/agents/support/nodes/booking/toolsBooking.ts)); un wrapper lo adapta al estado del grafo padre:

```ts
// El sub-agente corre su propio bucle ReAct y devuelve sus mensajes al padre
async function bookingNode(state: State): Promise<Partial<State>> {
  const result = await booking.invoke({ messages: state.messages });
  return { messages: result.messages };
}
```

### 6.5 Composición del grafo con checkpointer inyectable

[src/agents/support/agent.ts](src/agents/support/agent.ts) — el grafo se construye en una factory que recibe el checkpointer, para poder usar `MemorySaver` en dev y `PostgresSaver` en producción:

```ts
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

  return builder.compile({ checkpointer: config?.checkpointer });
}
```

✅ **Antes de avanzar deberías poder:** trazar el camino completo de un mensaje "quiero agendar una cita" desde START hasta END.

---

## Fase 7 — Memoria persistente

**Objetivo:** que el agente recuerde la conversación entre peticiones y entre reinicios del servidor.

**Concepto clave:** un **checkpointer** guarda un snapshot del estado después de cada paso, indexado por `thread_id`. Al invocar de nuevo con el mismo `thread_id`, el grafo continúa donde quedó.

| Checkpointer | Uso | Persiste tras reinicio |
|---|---|---|
| `MemorySaver` | desarrollo / tests | ❌ (en RAM) |
| `PostgresSaver` | producción | ✅ |

### 7.1 Postgres con Docker

Referencia: [docker-compose.yml](docker-compose.yml) — Postgres 15-alpine, base de datos `agent`.

```bash
npm run db:up      # docker-compose up -d
npm run db:logs    # ver logs
npm run db:down    # apagar
```

### 7.2 Inicializar el checkpointer

Referencia: [src/api/db.ts](src/api/db.ts) — patrón singleton con `.setup()`:

```ts
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
// npm install @langchain/langgraph-checkpoint-postgres

const DB_URI = process.env.DB_URI ??
  "postgresql://postgres:postgres@localhost:5432/agent";

export async function initCheckpointer(): Promise<void> {
  _checkpointer = PostgresSaver.fromConnString(DB_URI);
  await _checkpointer.setup();   // crea las tablas (solo la primera vez)
}
```

### 7.3 Usarlo al invocar

```ts
const agent = makeGraph({ checkpointer: getCheckpointer() });

await agent.invoke(
  { messages: [new HumanMessage("Hola")] },
  { configurable: { thread_id: "chat-123" } }   // ← la clave de la memoria
);
```

> ⚠️ **Nota de aprendizaje (bug real que existió en este repo):** [agent.ts](src/agents/support/agent.ts) exporta `ragAgent = makeGraph({ checkpointer: new MemorySaver() })` y la ruta [chat.ts](src/api/routes/chat.ts) originalmente importaba esa instancia — llamaba a `getCheckpointer()` pero nunca lo pasaba al grafo, así que la API inicializaba Postgres pero conversaba con memoria RAM. La lección: **el checkpointer que importa es el que recibe `compile()`**, no el que inicializas por fuera. La corrección (ya aplicada en `chat.ts`) construye el grafo con `makeGraph({ checkpointer: getCheckpointer() })` de forma perezosa, después de que `initCheckpointer()` corrió en el arranque. El export `ragAgent` con `MemorySaver` se conserva solo para LangGraph Studio (`langgraph.json`).

✅ **Antes de avanzar deberías poder:** explicar qué guarda un checkpoint, qué papel juega `thread_id`, y por qué dos `thread_id` distintos no comparten historial.

---

## Fase 8 — Exponer el agente por API

**Objetivo:** servir el agente por HTTP con memoria por conversación y streaming de tokens.

Referencia: [src/main.ts](src/main.ts), [src/api/server.ts](src/api/server.ts), [src/api/routes/chat.ts](src/api/routes/chat.ts)

### 8.1 Entrypoint

```ts
import "dotenv/config";
import { app } from "./api/server";
import { initCheckpointer } from "./api/db";

async function main() {
  await initCheckpointer();          // memoria lista antes de aceptar tráfico
  app.listen(8000);
}
main();
```

### 8.2 Endpoint de invocación — `POST /chat/:chatId`

El `chatId` de la URL **es** el `thread_id`: cada chat tiene su propia memoria.

```ts
router.post("/:chatId", async (req, res) => {
  const config = { configurable: { thread_id: req.params.chatId } };
  const response = await agent.invoke(
    { messages: [new HumanMessage({ content: req.body.message })] },
    config
  );
  return res.json(response.messages);
});
```

### 8.3 Endpoint de streaming (SSE) — `POST /chat/:chatId/stream`

**Concepto clave:** `streamMode: "messages"` emite los tokens del LLM a medida que se generan; el servidor los reenvía como Server-Sent Events.

```ts
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.flushHeaders();

const stream = await agent.stream(
  { messages: [humanMessage] },
  { ...config, streamMode: "messages" }
);

for await (const [messageChunk] of stream) {
  if (messageChunk?.content) {
    res.write(`data: ${messageChunk.content}\n\n`);
  }
}
res.end();
```

### 8.4 Probarlo

```bash
npm run db:up && npm run dev

curl -X POST http://localhost:8000/chat/prueba-1 \
  -H "Content-Type: application/json" \
  -d '{"message": "Hola, soy Jorge"}'

# Segunda petición al MISMO chatId: debe recordar el nombre
curl -X POST http://localhost:8000/chat/prueba-1 \
  -H "Content-Type: application/json" \
  -d '{"message": "¿Cómo me llamo?"}'
```

✅ **Antes de avanzar deberías poder:** demostrar que dos `chatId` distintos tienen memorias independientes.

---

## Fase 9 — Ejecución, debugging y siguientes pasos

### Comandos del proyecto

| Comando | Qué hace |
|---|---|
| `npm run dev` | servidor con hot-reload (`tsx watch src/main.ts`) |
| `npm run start` | servidor sin watch |
| `npm run db:up` / `db:down` / `db:logs` | Postgres con Docker |
| `npx tsx src/archivo.ts` | ejecutar cualquier script suelto |
| `npx @langchain/langgraph-cli dev` | LangGraph Studio (visualizar y depurar grafos) |
| `npx tsc` | build de producción a `dist/` |
| `ollama serve` | levantar el servicio de Ollama (normalmente ya corre como background service) |
| `ollama pull <modelo>` | descargar un modelo local (Fase 1B) |
| `ollama list` | ver modelos descargados |
| `ollama rm <modelo>` | borrar un modelo local y liberar espacio |

### Debugging

- **LangGraph Studio** es la herramienta principal: muestra el grafo, el estado en cada paso y permite re-ejecutar desde un checkpoint. Requiere los grafos registrados en `langgraph.json`.
- `console.log` dentro de los nodos funciona con `npx tsx` (los nodos son funciones normales).
- Para inspeccionar la memoria: las tablas `checkpoint*` en la base `agent` de Postgres.

### Checklist final de autoevaluación

- [ ] Sé crear un proyecto TS con LangGraph desde cero (Fase 1).
- [ ] Sé definir tools con zod y usar `createReactAgent` (Fase 2).
- [ ] Sé extender el estado con `Annotation` y explicar los reducers (Fase 3).
- [ ] Sé usar `withStructuredOutput` para extraer datos tipados (Fase 4).
- [ ] Sé implementar paralelismo, `Send` y bucles con condición de salida (Fase 5).
- [ ] Sé componer un agente multi-nodo con router y sub-agente (Fase 6).
- [ ] Sé configurar `PostgresSaver` y explicar `thread_id` (Fase 7).
- [ ] Sé exponer el agente con Express y streaming SSE (Fase 8).

### Temas para profundizar (aún no cubiertos en este repo)

1. **Supervisor multi-agente** — `@langchain/langgraph-supervisor` ya está instalado pero sin usar: un agente coordinador que delega en agentes especializados.
2. **Human-in-the-loop** — `interrupt()` para pausar el grafo y esperar aprobación humana (ej: confirmar la reserva antes de ejecutarla).
3. **Memoria a largo plazo (Store)** — a diferencia del checkpointer (memoria *por thread*), el `Store` guarda hechos *entre threads* (ej: preferencias del usuario).
4. **Plantillas de prompts con Nunjucks** — instalado en el repo; separar prompts del código.
5. **Evals** — medir sistemáticamente la calidad del agente (LangSmith o scripts propios).
6. **Corregir el bug del checkpointer** de la Fase 7 como ejercicio práctico.
