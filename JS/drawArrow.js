function drawArrowFromPoints(points) {
  if (points.length < 2) return;
  
  // Remove any previous arrow preview.
  if (arrowElementGroup) {
    svg.removeChild(arrowElementGroup);
    arrowElementGroup = null;
  }
  
  const rc = rough.svg(svg);
  
  // Create the smooth path string.
  const d = getSmoothPath(points);
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
  
  // Compute the arrow head using the last two points.
  const len = points.length;
  const lastPoint = points[len - 1];
  const secondLastPoint = points[len - 2];
  const angle = Math.atan2(lastPoint.y - secondLastPoint.y, lastPoint.x - secondLastPoint.x);
  const arrowHead = createArrowHead(lastPoint.x, lastPoint.y, angle);
  
  // Group the line and arrow head together.
  arrowElementGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  arrowElementGroup.appendChild(line);
  arrowElementGroup.appendChild(arrowHead);
  
  svg.appendChild(arrowElementGroup);
}


function drawArrow(x1, y1, x2, y2) {
  // Remove old arrow element if it exists.
  if (arrowElementGroup) {
    svg.removeChild(arrowElementGroup);
    arrowElementGroup = null;
  }

  // Snap endpoints if available.
  const startSnap = getSnapPoint ? getSnapPoint(x1, y1) : { x: x1, y: y1 };
  const endSnap = getSnapPoint ? getSnapPoint(x2, y2) : { x: x2, y: y2 };
  x1 = startSnap.x;
  y1 = startSnap.y;
  x2 = endSnap.x;
  y2 = endSnap.y;

  const rc = rough.svg(svg);

  // Draw the main line for the arrow.
  const line = rc.line(x1, y1, x2, y2, {
    stroke: arrowStrokeColor,
    strokeWidth: arrowStrokeThickness,
  });

  if (arrowOutlineStyle === "dashed") {
    line.setAttribute("stroke-dasharray", "10,10");
  } else if (arrowOutlineStyle === "dotted") {
    line.setAttribute("stroke-dasharray", "2,8");
  }

  // Calculate the angle for the arrow head.
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const arrowHead = createArrowHead(x2, y2, angle);

  // Group the line and arrow head together.
  arrowElementGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  arrowElementGroup.appendChild(line);
  arrowElementGroup.appendChild(arrowHead);

  svg.appendChild(arrowElementGroup);
}
