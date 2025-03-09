let circleStartX, circleStartY;
let circleElement = null;

let circleStrokeColor = "#fff";
let circleFillColor = "#fff";
let circleFillStyle = "transparent";
let circleStrokeThickness = 2;
let circleOutlineStyle = "solid";

let circleColorOptions = document.querySelectorAll(".circleStrokeSpan");
let circleFillColorOptions = document.querySelectorAll(".circleBackgroundSpan");
let circleFillStyleOptions = document.querySelectorAll(".circleFillStyleSpan");
let circleStrokeThicknessValue = document.querySelectorAll(".circleStrokeThickSpan");
let circleOutlineStyleValue = document.querySelectorAll(".circleOutlineStyle");


function drawEllipseFromOrigin(originX, originY, pointerX, pointerY) {
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

    // Calculate the radii of the ellipse
    const rx = Math.abs(dx); // Radius on the x-axis
    const ry = Math.abs(dy); // Radius on the y-axis

    const centerX = (adjustedOriginX + adjustedPointerX) / 2;
    const centerY = (adjustedOriginY + adjustedPointerY) / 2;

    const rc = rough.svg(svg);

    let actualFillColor = circleFillColor;
    if (circleFillStyle === "transparent") {
        actualFillColor = "rgba(0,0,0,0)";
    }

    // Draw the ellipse using the calculated center and diameters in viewBox coordinates
    const element = rc.ellipse(centerX, centerY, rx * 2, ry * 2, {
        stroke: circleStrokeColor,
        strokeWidth: circleStrokeThickness,
        fill: actualFillColor,
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
    const overlay = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    overlay.setAttribute("x", centerX - rx);
    overlay.setAttribute("y", centerY - ry);
    overlay.setAttribute("width", rx * 2);
    overlay.setAttribute("height", ry * 2);
    overlay.setAttribute("fill", "rgba(0,0,0,0)"); // fully transparent
    overlay.style.pointerEvents = "all"; // capture pointer events

    // Group the circle and overlay together.
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.appendChild(element);
    group.appendChild(overlay);

    // Store data attributes for undo/redo
    group.setAttribute('data-centerX', centerX);
    group.setAttribute('data-centerY', centerY);
    group.setAttribute('data-rx', rx);
    group.setAttribute('data-ry', ry);
    group.setAttribute('data-originX', adjustedOriginX);
    group.setAttribute('data-originY', adjustedOriginY);
    group.setAttribute('data-pointerX', adjustedPointerX);
    group.setAttribute('data-pointerY', adjustedPointerY);
    group.setAttribute('data-type', 'ellipse-group');
    group.shape = element; // Store the rough element
    group.overlay = overlay;
    group.actualFillColor = actualFillColor;
    group.circleFillStyle = circleFillStyle;
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
        drawEllipseFromOrigin(circleStartX, circleStartY, e.clientX, e.clientY);
    }
}

function handlePointerUpCircle(e) {
    // Remove pointermove listener from all tools
    svg.removeEventListener("pointermove", handlePointerMoveCircle);
    if (isCircleToolActive && circleElement) {
      const centerX = parseFloat(circleElement.getAttribute('data-centerX'));
      const centerY = parseFloat(circleElement.getAttribute('data-centerY'));
      const rx = parseFloat(circleElement.getAttribute('data-rx'));
      const ry = parseFloat(circleElement.getAttribute('data-ry'));
      const originX = parseFloat(circleElement.getAttribute('data-originX'));
      const originY = parseFloat(circleElement.getAttribute('data-originY'));
      const pointerX = parseFloat(circleElement.getAttribute('data-pointerX'));
      const pointerY = parseFloat(circleElement.getAttribute('data-pointerY'));

        const action = {
            type: ACTION_CREATE,
            element: circleElement,
            parent: circleElement.parentNode,
            nextSibling: circleElement.nextSibling,
            data: {
                centerX: centerX,
                centerY: centerY,
                rx: rx,
                ry: ry,
                originX: originX,
                originY: originY,
                pointerX: pointerX,
                pointerY: pointerY,
                stroke: circleStrokeColor,
                fill: circleFillColor,
                fillStyle: circleFillStyle,
                strokeWidth: circleStrokeThickness,
                outlineStyle: circleOutlineStyle
            }
        };

        history.push(action);
        circleElement = null;
        redoStack = [];
        updateUndoRedoButtons();
    }
}


circleColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        const previousColor = circleStrokeColor;
        circleColorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        circleStrokeColor = span.getAttribute("data-id");

        if (circleElement) {
            circleElement.shape.setAttribute('stroke', circleStrokeColor);
            const action = {
                type: ACTION_MODIFY,
                element: circleElement,
                data: { property: 'stroke', newValue: circleStrokeColor, oldValue: previousColor }
            };
            history.push(action);
            redoStack = [];
            updateUndoRedoButtons();
        }
        console.log("Selected Stroke Color:", circleStrokeColor);
    });
});

circleFillColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        const previousColor = circleFillColor;
        circleFillColorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        circleFillColor = span.getAttribute("data-id");

        if (circleElement) {
            if (circleElement.circleFillStyle !== "transparent") {
                 circleElement.shape.setAttribute('fill', circleFillColor);
                 circleElement.actualFillColor = circleFillColor;
            }
            const action = {
                type: ACTION_MODIFY,
                element: circleElement,
                data: { property: 'fill', newValue: circleFillColor, oldValue: previousColor }
            };
            history.push(action);
            redoStack = [];
            updateUndoRedoButtons();
        }
        console.log("Selected Background Color:", circleFillColor);
    });
});

circleFillStyleOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        const previousFill = circleFillStyle;
        circleFillStyleOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        circleFillStyle = span.getAttribute("data-id");

        if (circleElement) {

             let fillColor = circleFillColor;
            if (circleFillStyle === "transparent") {
                fillColor = "rgba(0,0,0,0)";
            }

            circleElement.shape.setAttribute('fill', fillColor);
            circleElement.actualFillColor = fillColor;
            circleElement.circleFillStyle = circleFillStyle;


            const action = {
                type: ACTION_MODIFY,
                element: circleElement,
                data: { property: 'fillStyle', newValue: circleFillStyle, oldValue: previousFill }
            };
            history.push(action);
            redoStack = [];
            updateUndoRedoButtons();
        }
        console.log("Selected Fill Style:", circleFillStyle);
        event.stopPropagation()
    });
});

circleStrokeThicknessValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        const previousThickness = circleStrokeThickness;
        circleStrokeThicknessValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        circleStrokeThickness = parseInt(span.getAttribute("data-id"));

        if (circleElement) {
            circleElement.shape.setAttribute('strokeWidth', circleStrokeThickness);
            const action = {
                type: ACTION_MODIFY,
                element: circleElement,
                data: { property: 'strokeWidth', newValue: circleStrokeThickness, oldValue: previousThickness }
            };
            history.push(action);
            redoStack = [];
            updateUndoRedoButtons();
        }
        console.log("Selected Stroke Thickness:", circleStrokeThickness);
        event.stopPropagation()
    });
});

circleOutlineStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        const previousOutlineStyle = circleOutlineStyle;
        circleOutlineStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        circleOutlineStyle = span.getAttribute("data-id");

        if (circleElement) {
            if (circleOutlineStyle === "dashed") {
                circleElement.shape.setAttribute("stroke-dasharray", "10,10");
            } else if (circleOutlineStyle === "dotted") {
                 circleElement.shape.setAttribute("stroke-dasharray", "2,8");
            } else {
                circleElement.shape.setAttribute("stroke-dasharray", "");  // Remove dash array for solid
            }
            const action = {
                type: ACTION_MODIFY,
                element: circleElement,
                data: { property: 'outlineStyle', newValue: circleOutlineStyle, oldValue: previousOutlineStyle }
            };
            history.push(action);
            redoStack = [];
            updateUndoRedoButtons();
        }
        console.log("Selected Outline Style:", circleOutlineStyle);
        event.stopPropagation()
    });
});