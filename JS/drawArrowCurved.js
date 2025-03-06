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


function createArrowHead(tipX, tipY, angle) {
  const rc = rough.svg(svg);
  const arrowHeadAngle = arrowHeadAngleDeg * Math.PI / 180;
  let points;
  
  if (arrowHeadStyle === "default") {
    // Default V-shaped arrowhead.
    points = [
      [tipX, tipY],
      [tipX - arrowHeadLength * Math.cos(angle - arrowHeadAngle), tipY - arrowHeadLength * Math.sin(angle - arrowHeadAngle)],
      [tipX - arrowHeadLength * Math.cos(angle + arrowHeadAngle), tipY - arrowHeadLength * Math.sin(angle + arrowHeadAngle)]
    ];
  } 
  
  else if (arrowHeadStyle === "square") {
    // Create a square arrow head (proper square end) that is filled.
    // We'll treat arrowHeadLength as the side-length of the square.
    const L = arrowHeadLength;
    // v: unit vector along the arrow's direction.
    const v = { x: Math.cos(angle), y: Math.sin(angle) };
    // w: unit vector perpendicular to the arrow's direction.
    const w = { x: -Math.sin(angle), y: Math.cos(angle) };
  
    // Define the square so that its left side is flush with the arrow tip.
    // The arrow tip (tipX, tipY) will be the midpoint of the left side.
    // Left side endpoints:
    const A = [ tipX + (L/2) * w.x, tipY + (L/2) * w.y ]; // top-left
    const B = [ tipX - (L/2) * w.x, tipY - (L/2) * w.y ]; // bottom-left
    // Right side endpoints:
    const D = [ tipX + L * v.x + (L/2) * w.x, tipY + L * v.y + (L/2) * w.y ]; // top-right
    const C = [ tipX + L * v.x - (L/2) * w.x, tipY + L * v.y - (L/2) * w.y ]; // bottom-right
    
    // Build the points array in order.
    const points = [ A, B, C, D ];
  
    // Create a filled polygon using Rough.js with a solid fill.
    const rc = rough.svg(svg);
    const arrowHeadElement = rc.polygon(points, {
        fill: arrowStrokeColor,
        stroke: arrowStrokeColor,
        fillStyle: 'solid', // Ensures a solid fill.
        strokeWidth: arrowStrokeThickness,
    });
    
    // Optionally, apply dash styles if needed.
    if (arrowOutlineStyle === "dashed") {
      arrowHeadElement.setAttribute("stroke-dasharray", "10,10");
    } else if (arrowOutlineStyle === "dotted") {
      arrowHeadElement.setAttribute("stroke-dasharray", "2,8");
    }
    
    return arrowHeadElement;
  }
  
  
  
  else if (arrowHeadStyle === "solid") {
    // Create a circular filled arrow head.
    // Here, we treat arrowHeadLength as the radius of the circle.
    const rc = rough.svg(svg);
    // rough.js circle takes the diameter as the size parameter.
    const diameter = arrowHeadLength * 1;
    const arrowHeadElement = rc.circle(tipX, tipY, diameter, {
      fill: arrowStrokeColor,
      stroke: arrowStrokeColor,
      fillStyle: 'solid',
      strokeWidth: 0.8,

    });
    
    return arrowHeadElement;
  }

  
  
  else if (arrowHeadStyle === "outline") {
    // Create a circular filled arrow head.
    // Here, we treat arrowHeadLength as the radius of the circle.
    const rc = rough.svg(svg);
    // rough.js circle takes the diameter as the size parameter.
    const diameter = arrowHeadLength * 1.2;
    const arrowHeadElement = rc.circle(tipX, tipY, diameter, {
      fill: arrowStrokeColor,
      stroke: arrowStrokeColor,
      fillStyle: 'none',
      strokeWidth: 0.2,

    });
    
    return arrowHeadElement;
  }
  
  const arrowHeadElement = rc.polygon(points, {
    fill: arrowStrokeColor,
    stroke: arrowStrokeColor,
    strokeWidth: arrowStrokeThickness,
  });
  
  if (arrowOutlineStyle === "dashed") {
    arrowHeadElement.setAttribute("stroke-dasharray", "10,10");
  } else if (arrowOutlineStyle === "dotted") {
    arrowHeadElement.setAttribute("stroke-dasharray", "2,8");
  }
  
  return arrowHeadElement;
}


function getSmoothPath(points) {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y} `;

  // If only two points, just draw a line.
  if (points.length === 2) {
    d += `L ${points[1].x} ${points[1].y}`;
    return d;
  }

  // Convert the Catmull-Rom spline to cubic Bezier segments.
  for (let i = 0; i < points.length - 1; i++) {
    // Define p0, p1, p2, p3 with boundary conditions.
    let p0 = i === 0 ? points[i] : points[i - 1];
    let p1 = points[i];
    let p2 = points[i + 1];
    let p3 = i + 2 < points.length ? points[i + 2] : p2;

    // Catmull-Rom to Cubic Bezier conversion matrix:
    let cp1x = p1.x + (p2.x - p0.x) / 12;
    let cp1y = p1.y + (p2.y - p0.y) / 12;
    let cp2x = p2.x - (p3.x - p1.x) / 12;
    let cp2y = p2.y - (p3.y - p1.y) / 12;

    d += `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y} `;
  }
  return d;
}



svg.addEventListener('pointerdown', handlePointerDownCurveArrow);
svg.addEventListener('pointerup', handlePointerUpCurveArrow);

function handlePointerDownCurveArrow(e) {
  if (arrowCurved) {
    arrowPoints = [];
    arrowPoints.push({ x: e.clientX, y: e.clientY });
  }
  svg.addEventListener("pointermove", handlePointerMoveCurveArrow);
}

function handlePointerMoveCurveArrow(e) {
  if (isArrowToolActive) {
    if (arrowCurved) {
      arrowPoints.push({ x: e.clientX, y: e.clientY });
      drawArrowFromPoints(arrowPoints);
    } 
}
}

function handlePointerUpCurveArrow(e) {
  svg.removeEventListener("pointermove", handlePointerMoveCurveArrow);
  if (isArrowToolActive) {
    if (arrowCurved) {
      drawArrowFromPoints(arrowPoints);
      if (arrowElementGroup) {
        history.push(arrowElementGroup);
        arrowElementGroup = null;
      }
    }
  }
}