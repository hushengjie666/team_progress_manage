import type { BusinessRow } from "../../../src/teamBusinessRows";
import type { BusinessOperation } from "../../../src/teamBusinessMutations";

export const businessOperationRows = (body: { operations?: BusinessOperation[] }): BusinessRow[] =>
  (body.operations ?? []).flatMap((operation) => {
    if (operation.operation === "delete") return [];
    if (operation.operation === "create") return [operation.row];
    return [{
      workspace_id: operation.workspace_id,
      entity: operation.entity,
      id: operation.id,
      updated_at: operation.updated_at,
      payload: operation.patch,
    } as unknown as BusinessRow];
  });
