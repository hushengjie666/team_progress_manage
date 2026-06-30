const PROJECT_TONE_COUNT = 6;

export const projectToneClassName = (projectKey: string) => {
  let hash = 0;
  for (let index = 0; index < projectKey.length; index += 1) {
    hash = (hash * 31 + projectKey.charCodeAt(index)) % 9973;
  }
  return `project-tone-${(hash % PROJECT_TONE_COUNT) + 1}`;
};
