export const releaseContract = {
  releaseVersion: "0.2.19",
  apiProtocolVersion: 2,
  databaseSchemaVersion: 22,
  minimumClientRelease: "0.2.19",
} as const;

export type ReleaseContract = typeof releaseContract;
