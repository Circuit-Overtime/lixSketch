function drawCircleFromOrigin(originX, originY, pointerX, pointerY) {
  // Remove the old circle element if it exists
  if (circleElement) {
    svg.removeChild(circleElement);
    circleElement = null;
  }
  
  // Convert the origin and pointer coordinates from screen/canvas space to viewBox space.
  const adjustedOriginX = currentViewBox.x + (originX / currentZoom);
  const adjustedOriginY = currentViewBox.y + (originY / currentZoom);
  const adjustedPointerX = currentViewBox.x + (pointerX / currentZoom);
  const adjustedPointerY = currentViewBox.y + (pointerY / currentZoom);
  
  // Calculate distances from the adjusted origin (in viewBox coordinates)
  const dx = adjustedPointerX - adjustedOriginX;
  const dy = adjustedPointerY - adjustedOriginY;
  // Use the maximum absolute distance to form a square bounding box for the circle
  const diameter = Math.max(Math.abs(dx), Math.abs(dy));
  
  // Calculate the circle's center so that the origin remains the corner of the bounding box
  const centerX = adjustedOriginX + diameter / 2;
  const centerY = adjustedOriginY + diameter / 2;
  
  const rc = rough.svg(svg);
  // Draw the circle using the calculated center and diameter in viewBox coordinates
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
  
  // Create an invisible overlay rectangle covering the circle's bounding box.
  // The bounding box is defined as:
  // x = centerX - diameter/2, y = centerY - diameter/2, width = diameter, height = diameter.
  const overlay = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  overlay.setAttribute("x", centerX - diameter / 2);
  overlay.setAttribute("y", centerY - diameter / 2);
  overlay.setAttribute("width", diameter);
  overlay.setAttribute("height", diameter);
  overlay.setAttribute("fill", "rgba(0,0,0,0)"); // fully transparent
  overlay.style.pointerEvents = "all"; // capture pointer events
  
  // Group the circle and overlay together.
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.appendChild(element);
  group.appendChild(overlay);
  
  circleElement = group;
  svg.appendChild(group);
}
