function drawCircleFromOrigin(originX, originY, pointerX, pointerY) {
    // Remove the old circle element if it exists
    if (circleElement) {
      svg.removeChild(circleElement);
      circleElement = null;
    }
    
    // Calculate distances from the origin
    const dx = pointerX - originX;
    const dy = pointerY - originY;
    // Use the maximum absolute distance for a square bounding box
    const diameter = Math.max(Math.abs(dx), Math.abs(dy));
    
    // Calculate the circle's center from the origin and diameter
    const centerX = originX + diameter / 2;
    const centerY = originY + diameter / 2;
    
    const rc = rough.svg(svg);
    // Draw the circle using the calculated center and diameter
    const element = rc.circle(centerX, centerY, diameter, {
      stroke: circleStrokeColor,
      strokeWidth: circleStrokeThickness,
      fill: circleFillColor,
      fillStyle: circleFillStyle,
      hachureAngle: 60,
      hachureGap: 10
    });
    
    // Apply outline style using SVG's stroke-dasharray attribute
    if (circleOutlineStyle === "dashed") {
      element.setAttribute("stroke-dasharray", "10,10");
    } else if (circleOutlineStyle === "dotted") {
      element.setAttribute("stroke-dasharray", "2,8");
    }
    
    // Create an invisible overlay rectangle that covers the circle's bounding box.
    // The circle's bounding box is defined by:
    // x = centerX - diameter/2, y = centerY - diameter/2, width = diameter, height = diameter.
    const overlay = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    overlay.setAttribute("x", centerX - diameter / 2);
    overlay.setAttribute("y", centerY - diameter / 2);
    overlay.setAttribute("width", diameter);
    overlay.setAttribute("height", diameter);
    overlay.setAttribute("fill", "rgba(0,0,0,0)"); // fully transparent
    overlay.style.pointerEvents = "all"; // ensure it captures clicks
    
    // Group the circle and overlay together.
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.appendChild(element);
    group.appendChild(overlay);
    
    circleElement = group;
    svg.appendChild(group);
  }
  