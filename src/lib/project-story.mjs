// Exhibition copy adapted from the team's form answers (questions 5–9).
export const storyFields = ['oneLineIntro', 'motivation', 'dataUse', 'features', 'memory'];
export function getProjectStory(project) {
  const story = project?.story;
  if (!story || storyFields.some(field => typeof story[field] !== 'string' || !story[field].trim())) return null;
  return Object.fromEntries(storyFields.map(field => [field, story[field].trim()]));
}
