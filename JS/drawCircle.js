
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

svg.addEventListener('pointerdown', handlePointerDownCircle);
svg.addEventListener('pointerup', handlePointerUpCircle);

function handlePointerDownCircle(e) {
  if (isCircleToolActive) {
    circleStartX = e.clientX;
    circleStartY = e.clientY;
    // Remove any existing preview circle
    if (circleElement) {
      svg.removeChild(circleElement);
      circleElement = null;
    }
    svg.addEventListener("pointermove", handlePointerMoveCircle);
  }
}

function handlePointerMoveCircle(e) {
  if (isCircleToolActive) {
    // Here we're using the function that grows the circle from the pointer origin
    drawCircleFromOrigin(circleStartX, circleStartY, e.clientX, e.clientY);
  }
}

function handlePointerUpCircle(e) {
  // Remove pointermove listener from all tools
  svg.removeEventListener("pointermove", handlePointerMoveCircle);
  if (isCircleToolActive && circleElement) {
    history.push(circleElement);
    circleElement = null;
  }
}


circleColorOptions.forEach((span) => {
  span.addEventListener("click", (event) => {
      event.stopPropagation(); // Stop event propagation
      circleColorOptions.forEach((el) => el.classList.remove("selected"));
      span.classList.add("selected");
      circleStrokeColor = span.getAttribute("data-id");
      console.log("Selected Stroke Color:", circleStrokeColor);
  });
});

circleFillColorOptions.forEach((span) => {
  span.addEventListener("click", (event) => {
      event.stopPropagation(); // Stop event propagation
      circleFillColorOptions.forEach((el) => el.classList.remove("selected"));
      span.classList.add("selected");
      circleFillColor = span.getAttribute("data-id");
      console.log("Selected Background Color:", circleFillColor);
  });
});

circleFillStyleOptions.forEach((span) => {
  span.addEventListener("click", (event) => {
      circleFillStyleOptions.forEach((el) => el.classList.remove("selected"));
      span.classList.add("selected");
      circleFillStyle = span.getAttribute("data-id");
      console.log("Selected Fill Style:", circleFillStyle);
      event.stopPropagation()
  });
});

circleStrokeThicknessValue.forEach((span) => {
  span.addEventListener("click", (event) => {
      circleStrokeThicknessValue.forEach((el) => el.classList.remove("selected"));
      span.classList.add("selected");
      circleStrokeThickness = parseInt(span.getAttribute("data-id"));
      console.log("Selected Stroke Thickness:", circleStrokeThickness);
      event.stopPropagation()
  });
});

circleOutlineStyleValue.forEach((span) => {
  span.addEventListener("click", (event) => {
      circleOutlineStyleValue.forEach((el) => el.classList.remove("selected"));
      span.classList.add("selected");
      circleOutlineStyle = span.getAttribute("data-id");
      console.log("Selected Outline Style:", circleOutlineStyle);
      event.stopPropagation()
  });
});