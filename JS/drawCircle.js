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
    
    circleElement = element;
    svg.appendChild(element);
}
