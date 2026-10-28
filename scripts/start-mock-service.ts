import { MockShiprocketServer } from "./mock-shiprocket-server";

const server = new MockShiprocketServer({ port: 3456, initialScenario: "normal" });
server.start().then((url) => {
  console.log(`[Mock Shiprocket Server] Listening on ${url}`);
});

process.on("SIGINT", async () => {
  await server.stop();
  process.exit(0);
});
