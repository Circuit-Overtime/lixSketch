function drawArrowFromPoints(points) {
  if (points.length < 2) return;
  
  // Remove any previous arrow preview.
  if (arrowElementGroup) {
    svg.removeChild(arrowElementGroup);
    arrowElementGroup = null;
  }
  
  // Convert each point from screen to viewBox coordinates.
  const convertedPoints = points.map(p => {
    // If your points are objects like { x, y }:
    const [vx, vy] = screenToViewBoxPoint(p.x, p.y);
    return { x: vx, y: vy };
  });
  
  const rc = rough.svg(svg);
  
  // Create the smooth path string using the converted points.
  const d = getSmoothPath(convertedPoints);
  const line = rc.path(d, {
    stroke: arrowStrokeColor,
    strokeWidth: arrowStrokeThickness,
    roughness: 1,
  });
  
  // Apply outline style if needed.
  if (arrowOutlineStyle === "dashed") {
    line.setAttribute("stroke-dasharray", "10,10");
  } else if (arrowOutlineStyle === "dotted") {
    line.setAttribute("stroke-dasharray", "2,8");
  }
  
  // Compute the arrow head using the last two converted points.
  const len = convertedPoints.length;
  const lastPoint = convertedPoints[len - 1];
  const secondLastPoint = convertedPoints[len - 2];
  const angle = Math.atan2(lastPoint.y - secondLastPoint.y, lastPoint.x - secondLastPoint.x);
  const arrowHead = createArrowHead(lastPoint.x, lastPoint.y, angle);
  
  // Group the line and arrow head together.
  arrowElementGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  arrowElementGroup.appendChild(line);
  arrowElementGroup.appendChild(arrowHead);
  
  svg.appendChild(arrowElementGroup);
}
