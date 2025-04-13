function drawSquare(x, y, width, height) {
    // Remove previous square element if it exists.
    if (squareElement) {
        svg.removeChild(squareElement);
        squareElement = null;
    }

    // Convert screen coordinates to viewBox space.
    const adjustedX = currentViewBox.x + (x / currentZoom);
    const adjustedY = currentViewBox.y + (y / currentZoom);
    let actualFillColor = squareBackgroundColor;

    if (squareFillStyleValue === "transparent") {
        actualFillColor = "rgba(0,0,0,0)"; // Set to transparent
    }

    // Create the main <g> container
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("data-x", adjustedX);
    group.setAttribute("data-y", adjustedY);
    group.setAttribute("data-width", width / currentZoom);
    group.setAttribute("data-height", height / currentZoom);
    group.setAttribute("data-type", "square-group"); // Tag for selection
    group.setAttribute("transform", `translate(${adjustedX}, ${adjustedY})`);

    // Transparent rect for click detection
    const overlayRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    overlayRect.setAttribute("x", "0");
    overlayRect.setAttribute("y", "0");
    overlayRect.setAttribute("width", width / currentZoom);
    overlayRect.setAttribute("height", height / currentZoom);
    overlayRect.setAttribute("fill", "rgba(0,0,0,0)"); // Fully transparent
    overlayRect.style.pointerEvents = "all"; // Capture pointer events

    // Actual visible rectangle
    const mainRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    mainRect.setAttribute("x", "0");
    mainRect.setAttribute("y", "0");
    mainRect.setAttribute("width", width / currentZoom);
    mainRect.setAttribute("height", height / currentZoom);
    mainRect.setAttribute("fill", actualFillColor);
    mainRect.setAttribute("stroke", squareStrokecolor);
    mainRect.setAttribute("stroke-width", squareStrokeThicknes);

    if (squareOutlineStyle === "dashed") {
        mainRect.setAttribute("stroke-dasharray", "10,10");
    } else if (squareOutlineStyle === "dotted") {
        mainRect.setAttribute("stroke-dasharray", "2,8");
    }

    // Generate Rough.js pattern
    const rc = rough.svg(svg);
    const roughShape = rc.rectangle(0, 0, width / currentZoom, height / currentZoom, {
        stroke: squareStrokecolor,
        strokeWidth: squareStrokeThicknes,
        fill: actualFillColor,
        fillStyle: squareFillStyleValue,
        hachureAngle: 60,
        hachureGap: 10
    });

    // Extract child nodes of Rough.js <g> and append manually to the main group
    while (roughShape.firstChild) {
        group.appendChild(roughShape.firstChild);
    }

    // Append elements to the main <g>
    group.appendChild(overlayRect);
    group.appendChild(mainRect);

    // Store the group as the square element
    squareElement = group;
    svg.appendChild(group);
}
