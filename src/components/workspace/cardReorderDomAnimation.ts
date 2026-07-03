type ProjectIdFromElement = (element: HTMLElement) => string | undefined;

export function captureReorderItemRects(
  container: HTMLElement,
  itemSelector: string,
  getProjectIdFromElement: ProjectIdFromElement,
) {
  const rects = new Map<string, DOMRect>();
  container.querySelectorAll<HTMLElement>(itemSelector).forEach((element) => {
    const projectId = getProjectIdFromElement(element);
    if (projectId) rects.set(projectId, element.getBoundingClientRect());
  });
  return rects;
}

export function animateReorderFromRects(
  container: HTMLElement,
  itemSelector: string,
  getProjectIdFromElement: ProjectIdFromElement,
  draggingProjectId: string,
  previousRects: Map<string, DOMRect>,
) {
  container.querySelectorAll<HTMLElement>(itemSelector).forEach((element) => {
    const projectId = getProjectIdFromElement(element);
    if (!projectId || projectId === draggingProjectId) return;
    const previous = previousRects.get(projectId);
    if (!previous) return;
    const next = element.getBoundingClientRect();
    const dx = previous.left - next.left;
    const dy = previous.top - next.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    element.getAnimations().forEach((animation) => animation.cancel());
    element.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: "translate(0, 0)" },
      ],
      {
        duration: 190,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    );
  });
}
