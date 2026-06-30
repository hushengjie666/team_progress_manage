import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { TimeManageMcpClient } from "./core.js";
import { registerTimeManageTools } from "./tools.js";

const main = async () => {
  const config = loadConfig();
  const server = new McpServer({
    name: "timemanage",
    version: "0.1.0",
  });
  registerTimeManageTools(server, new TimeManageMcpClient(config));
  await server.connect(new StdioServerTransport());
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
