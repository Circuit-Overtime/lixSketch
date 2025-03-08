let circleStartX, circleStartY;
let circleElement = null;

let circleStrokeColor = "#fff";
let circleFillColor = "#fff";
let circleFillStyle = "hachure";
let circleStrokeThickness = 2;
let circleOutlineStyle = "solid"; // Options: "solid", "dashed", "dotted"

let circleColorOptions = document.querySelectorAll(".circleStrokeSpan");
let circleFillColorOptions = document.querySelectorAll(".circleBackgroundSpan");
let circleFillStyleOptions = document.querySelectorAll(".circleFillStyleSpan");
let circleStrokeThicknessValue = document.querySelectorAll(".circleStrokeThickSpan");
let circleOutlineStyleValue = document.querySelectorAll(".circleOutlineStyle");


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

    // Store data attributes for undo/redo
    group.setAttribute('data-centerX', centerX);
    group.setAttribute('data-centerY', centerY);
    group.setAttribute('data-diameter', diameter);
    group.setAttribute('data-originX', adjustedOriginX);
    group.setAttribute('data-originY', adjustedOriginY);

    group.shape = element; // Store the rough element
    group.overlay = overlay;

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
      const centerX = parseFloat(circleElement.getAttribute('data-centerX'));
      const centerY = parseFloat(circleElement.getAttribute('data-centerY'));
      const diameter = parseFloat(circleElement.getAttribute('data-diameter'));
      const originX = parseFloat(circleElement.getAttribute('data-originX'));
      const originY = parseFloat(circleElement.getAttribute('data-originY'));

        const action = {
            type: ACTION_CREATE,
            element: circleElement,
            parent: circleElement.parentNode,
            nextSibling: circleElement.nextSibling,
            data: {
                centerX: centerX,
                centerY: centerY,
                diameter: diameter,
                originX: originX,
                originY: originY,
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