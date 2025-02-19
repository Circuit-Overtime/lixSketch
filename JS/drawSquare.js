function drawSquare(x, y, width, height) {
    // Remove previous square element if exists.
    if (squareElement) {
      svg.removeChild(squareElement);
      squareElement = null;
    }
  
    // Convert drawing coordinates from screen/canvas space to viewBox space.
    const adjustedX = currentViewBox.x + (x / currentZoom);
    const adjustedY = currentViewBox.y + (y / currentZoom);
  
    const rc = rough.svg(svg);
    const shape = rc.rectangle(adjustedX, adjustedY, width / currentZoom, height / currentZoom, {
      stroke: squareStrokecolor,
      strokeWidth: squareStrokeThicknes,
      fill: squareBackgroundColor,
      fillStyle: squareFillStyleValue,
      hachureAngle: 60,
      hachureGap: 10
    });
  
    if (squareOutlineStyle === "dashed") {
      shape.setAttribute("stroke-dasharray", "10,10");
    } else if (squareOutlineStyle === "dotted") {
      shape.setAttribute("stroke-dasharray", "2,8");
    }
  
    // Create a transparent overlay that will cover the entire drawn shape.
    const overlay = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    overlay.setAttribute("x", adjustedX);
    overlay.setAttribute("y", adjustedY);
    // Adjust width and height as well if needed (assuming they should scale)
    overlay.setAttribute("width", width / currentZoom);
    overlay.setAttribute("height", height / currentZoom);
    overlay.setAttribute("fill", "rgba(0,0,0,0)"); // Fully transparent
    overlay.style.pointerEvents = "all"; // Capture all pointer events
  
    // Group the drawn shape and the transparent overlay together.
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("data-x", adjustedX); // Store x, y, width and height
    group.setAttribute("data-y", adjustedY);
    group.setAttribute("data-width", width / currentZoom);
    group.setAttribute("data-height", height / currentZoom);
    group.setAttribute("data-type", "square-group"); //Mark the new group element
    // Store references to the shape and overlay within the group (VERY IMPORTANT).
    group.shape = shape; // Direct access for easier manipulation
    group.overlay = overlay;
  
    group.appendChild(shape);
    group.appendChild(overlay);
    // Store the group as the square element.
    squareElement = group;
    svg.appendChild(group);
  }