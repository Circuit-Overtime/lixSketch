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
    
    // Convert endpoints from screen to viewBox coordinates.
    const [vx1, vy1] = screenToViewBoxPoint(x1, y1);
    const [vx2, vy2] = screenToViewBoxPoint(x2, y2);
    
    const rc = rough.svg(svg);
    
    // Draw the main line for the arrow in viewBox coordinates.
    const line = rc.line(vx1, vy1, vx2, vy2, {
      stroke: arrowStrokeColor,
      strokeWidth: arrowStrokeThickness,
    });
    
    if (arrowOutlineStyle === "dashed") {
      line.setAttribute("stroke-dasharray", "10,10");
    } else if (arrowOutlineStyle === "dotted") {
      line.setAttribute("stroke-dasharray", "2,8");
    }
    
    // Calculate the angle for the arrow head.
    const angle = Math.atan2(vy2 - vy1, vx2 - vx1);
    const arrowHead = createArrowHead(vx2, vy2, angle);
    
    // Group the line and arrow head together.
    arrowElementGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    arrowElementGroup.appendChild(line);
    arrowElementGroup.appendChild(arrowHead);
    
    svg.appendChild(arrowElementGroup);
  }
  