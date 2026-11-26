export const releaseContract = {
  releaseVersion: "0.2.18",
  apiProtocolVersion: 2,
  databaseSchemaVersion: 21,
  minimumClientRelease: "0.2.18",
} as const;

export type ReleaseContract = typeof releaseContract;
