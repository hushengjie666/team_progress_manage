export const releaseContract = {
  releaseVersion: "0.2.16",
  apiProtocolVersion: 2,
  databaseSchemaVersion: 19,
  minimumClientRelease: "0.2.16",
} as const;

export type ReleaseContract = typeof releaseContract;
