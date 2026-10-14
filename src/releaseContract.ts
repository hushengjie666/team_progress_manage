export const releaseContract = {
  releaseVersion: "0.2.12",
  apiProtocolVersion: 2,
  databaseSchemaVersion: 15,
  minimumClientRelease: "0.2.12",
} as const;

export type ReleaseContract = typeof releaseContract;
