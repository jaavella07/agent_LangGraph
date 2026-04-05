import "dotenv/config";
import { app } from "./api/server";
import { initCheckpointer } from "./api/db";

const PORT = process.env.PORT ?? 8000;

async function main() {
  // Equivalente al lifespan de FastAPI
  await initCheckpointer();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main();