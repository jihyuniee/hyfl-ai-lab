import type { APIRoute } from 'astro';
import projects from '../../../../data/ai-data-projects.json';
import { getProjectCover } from '../../../../lib/project-media.mjs';

export function getStaticPaths() {
  return projects.map(project => {
    const cover = getProjectCover(project.id);
    return {
      params: { cover: `${project.id}-${cover.version}` },
      props: { projectId: project.id },
    };
  });
}

export const GET: APIRoute = ({ props }) => {
  const { bytes } = getProjectCover(props.projectId);
  return new Response(new Uint8Array(bytes), {
    headers: { 'Content-Type': 'image/webp' },
  });
};
