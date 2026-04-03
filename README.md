# Requisitos mínimos para Agentes IA en TypeScript

## 1. Iniciar proyecto
mkdir mi-agente
cd mi-agente
npm init -y

## 2. TypeScript
npm install typescript tsx @types/node --save-dev
npx tsc --init

# En tsconfig.json asegúrate de tener:
module: NodeNext
moduleResolution: NodeNext
target: ES2020

## 3. Variables de entorno
npm install dotenv

## 4. Core de Agentes
npm install @langchain/langgraph @langchain/core zod

## 5. Modelos LLM (instala solo los que uses)
npm install @langchain/openai        # GPT-4, GPT-4o
npm install @langchain/anthropic     # Claude
npm install langchain                # initChatModel (multi-provider)

## 6. Prompts con Nunjucks (opcional)
npm install nunjucks @types/nunjucks

## 7. Checkpointer — memoria entre conversaciones (opcional)
npm install @langchain/langgraph-checkpoint          # MemorySaver (incluido en langgraph)
npm install @langchain/langgraph-checkpoint-postgres # PostgresSaver (producción)

## 8. Multi-agente / Supervisor (opcional)
npm install @langchain/langgraph-supervisor

## 9. Archivos necesarios en el proyecto
mi-agente/
├── src/
│   └── agent.ts        # lógica del agente
├── .env                # API keys
├── langgraph.json      # config del servidor LangGraph
├── tsconfig.json
└── package.json

## 10. .env
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

## 11. langgraph.json
{
  "node_version": "20",
  "graphs": {
    "agent": "./src/agent.ts"
  }
}

## 12. Ejecutar sin compilar (desarrollo)
npx tsx src/agent.ts

## 13. LangGraph Studio / Dev Server
npx @langchain/langgraph-cli dev

## 14. Compilar para producción
npx tsc
node dist/agent.js

## 15. Bun (alternativa más rápida a Node, opcional)
# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"

# Usar en lugar de npx tsx
bun run src/agent.ts