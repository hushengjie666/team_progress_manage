import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const jsonResult = (value: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
});

export const textResult = (text: string): CallToolResult => ({
  content: [{ type: "text", text }],
});

export const handleTool = async (fn: () => Promise<unknown> | unknown): Promise<CallToolResult> => {
  try {
    return jsonResult(await fn());
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
    };
  }
};

export const requireConfirmation = (confirmed: boolean | undefined, action: string) => {
  if (!confirmed) {
    throw new Error(`${action} requires explicit user confirmation. Ask the user to confirm, then call again with confirmed=true.`);
  }
};
