function drawSquare(x, y, width, height) {
  // Remove previous square element if exists.
  if (squareElement) {
      svg.removeChild(squareElement);
      squareElement = null;
  }

  // Adjust drawing coordinates based on current viewBox
  const adjustedX = x + currentViewBox.x;
  const adjustedY = y + currentViewBox.y;

  const rc = rough.svg(svg);
  const shape = rc.rectangle(adjustedX, adjustedY, width, height, {
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
  // We use the same x, y, width and height as the square.
  const overlay = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  overlay.setAttribute("x", adjustedX);
  overlay.setAttribute("y", adjustedY);
  overlay.setAttribute("width", width);
  overlay.setAttribute("height", height);
  overlay.setAttribute("fill", "rgba(0,0,0,0)"); // Fully transparent
  overlay.style.pointerEvents = "all"; // Capture all pointer events

  // Group the drawn shape and the transparent overlay together.
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.appendChild(shape);
  group.appendChild(overlay);

  // Store the group as the square element.
  squareElement = group;
  svg.appendChild(group);
}