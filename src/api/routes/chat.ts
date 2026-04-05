import { Router, Request, Response } from "express";
import { HumanMessage } from "@langchain/core/messages";
import { getCheckpointer } from "../db";
import { ragAgent } from "../../agents/support/agent";

const router = Router();


router.post("/:chatId", async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const { message } = req.body as { message: string };

  const config = {
    configurable: { thread_id: chatId },
  };

  const checkpointer = getCheckpointer();
  const agent = ragAgent;
  const humanMessage = new HumanMessage({ content: message });

  const response = await agent.invoke(
    { messages: [humanMessage] },
    config
  );

  return res.json(response.messages);
});

// ─── POST /chat/:chatId/stream ────────────────────────────────────────────────
router.post("/:chatId/stream", async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const { message } = req.body as { message: string };

  const config = {
    configurable: { thread_id: chatId },
  };

  // ─── Headers SSE ─────────────────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const checkpointer = getCheckpointer();
  const agent = ragAgent;
  const humanMessage = new HumanMessage({ content: message });

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
});

export default router;