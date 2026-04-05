import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const DB_URI = process.env.DB_URI ?? 
  "postgresql://postgres:postgres@localhost:5432/agent";

let _checkpointer: PostgresSaver | null = null;

export async function initCheckpointer(): Promise<void> {
  _checkpointer = PostgresSaver.fromConnString(DB_URI);
  // Crea las tablas necesarias (solo la primera vez)
  await _checkpointer.setup();
  console.log("Checkpointer initialized");
}

export function getCheckpointer(): PostgresSaver {
  if (!_checkpointer) {
    throw new Error("Checkpointer not initialized. Call initCheckpointer() first.");
  }
  return _checkpointer;
}