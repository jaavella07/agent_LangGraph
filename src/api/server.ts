import express from "express";
import chatRouter from "./routes/chat";

export const app = express();

app.use(express.json());

app.get("/", (_, res) => {
  res.json({ Hello: "World" });
});

app.use("/chat", chatRouter);