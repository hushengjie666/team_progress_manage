export const releaseContract = {
  releaseVersion: "0.2.5",
  apiProtocolVersion: 1,
  databaseSchemaVersion: 8,
  minimumClientRelease: "0.2.5",
} as const;

export type ReleaseContract = typeof releaseContract;
