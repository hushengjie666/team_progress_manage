import { TimeManageMcpDiagnosticsClient } from "./coreDiagnostics.js";

export class TimeManageMcpClient extends TimeManageMcpDiagnosticsClient {}

export const requireConfirmation = (confirmed: boolean | undefined, action: string) => {
  if (!confirmed) {
    throw new Error(`${action} is high risk. Ask the user for explicit confirmation, then call again with confirmed=true.`);
  }
};
