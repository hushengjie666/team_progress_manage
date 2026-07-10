export const requireConfirmation = (confirmed: boolean | undefined, action: string) => {
  if (!confirmed) {
    throw new Error(`${action} requires explicit user confirmation. Ask the user to confirm, then call again with confirmed=true.`);
  }
};
