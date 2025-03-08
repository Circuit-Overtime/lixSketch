let squareStrokecolor = "#fff";
let squareBackgroundColor = "#fff";
let squareFillStyleValue = "hachure";
let squareStrokeThicknes = 2;
let squareOutlineStyle = "solid";
let squareElement = null;
let startX, startY;
let SquarecolorOptions = document.querySelectorAll(".squareStrokeSpan");
let backgroundColorOptionsSquare = document.querySelectorAll(".squareBackgroundSpan");
let fillStyleOptions = document.querySelectorAll(".squareFillStyleSpan");
let squareStrokeThicknessValue = document.querySelectorAll(".squareStrokeThickSpan");
let squareOutlineStyleValue = document.querySelectorAll(".squareOutlineStyle");



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


svg.addEventListener('pointerdown', handlePointerDownSquare);
svg.addEventListener('pointerup', handlePointerUpSquare);

function handlePointerDownSquare(e) {
    if (isSquareToolActive) {
        startX = e.clientX;
        startY = e.clientY;
        // Initialize squareElement to null before drawing a new one
        squareElement = null;
        svg.addEventListener("pointermove", handlePointerMoveSquare);
    }
}

function handlePointerMoveSquare(e) {
    if (isSquareToolActive) {
        const width = e.clientX - startX;
        const height = e.clientY - startY;
        drawSquare(startX, startY, width, height);
    }
}

function handlePointerUpSquare(e) {
    svg.removeEventListener("pointermove", handlePointerMoveSquare);

    if (isSquareToolActive && squareElement) {
        const action = {
            type: ACTION_CREATE,
            element: squareElement,
            parent: squareElement.parentNode,
            nextSibling: squareElement.nextSibling, // Preserve order
            data: {
                x: parseFloat(squareElement.getAttribute("data-x")),
                y: parseFloat(squareElement.getAttribute("data-y")),
                width: parseFloat(squareElement.getAttribute("data-width")),
                height: parseFloat(squareElement.getAttribute("data-height")),
                stroke: squareStrokecolor,
                strokeWidth: squareStrokeThicknes,
                fill: squareBackgroundColor,
                fillStyle: squareFillStyleValue,
                outlineStyle: squareOutlineStyle
            }
        };

        history.push(action);
        squareElement = null;
        redoStack = []; // Clear redo stack after a new action
        updateUndoRedoButtons();
    }
}




SquarecolorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation(); // Stop event propagation
        const previousColor = squareStrokecolor; // Store the previous color
        SquarecolorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        squareStrokecolor = span.getAttribute("data-id");

        // Store the modification action
        if (squareElement) { // Check if a square is currently drawn.
            const action = {
                type: ACTION_MODIFY,
                element: squareElement,
                data: { property: 'stroke', newValue: squareStrokecolor, oldValue: previousColor }
            };
            history.push(action);
            redoStack = [];
            updateUndoRedoButtons();
        }
        console.log("Selected Stroke Color:", squareStrokecolor);
    });
});

// Square Background Color Selection
backgroundColorOptionsSquare.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation(); // Stop event propagation
        const previousColor = squareBackgroundColor; // Store the previous background color
        backgroundColorOptionsSquare.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        squareBackgroundColor = span.getAttribute("data-id");

        // Store the modification action
        if (squareElement) { // Check if a square is currently drawn.
            const action = {
                type: ACTION_MODIFY,
                element: squareElement,
                data: { property: 'fill', newValue: squareBackgroundColor, oldValue: previousColor }
            };
            history.push(action);
            redoStack = [];
            updateUndoRedoButtons();
        }
        console.log("Selected Background Color:", squareBackgroundColor);
    });
});

// Square Fill Style Selection
fillStyleOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        const previousFill = squareFillStyleValue;
        fillStyleOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        squareFillStyleValue = span.getAttribute("data-id");

        if (squareElement) {
            const action = {
                type: ACTION_MODIFY,
                element: squareElement,
                data: { property: 'fillStyle', newValue: squareFillStyleValue, oldValue: previousFill }
            };
            history.push(action);
            redoStack = [];
            updateUndoRedoButtons();
        }
        console.log("Selected Fill Style:", squareFillStyleValue);
        event.stopPropagation()
    });
});


// Square Stroke Thickness Selection
squareStrokeThicknessValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        const previousThickness = squareStrokeThicknes;
        squareStrokeThicknessValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        squareStrokeThicknes = parseInt(span.getAttribute("data-id"));

        if (squareElement) {
            const action = {
                type: ACTION_MODIFY,
                element: squareElement,
                data: { property: 'strokeWidth', newValue: squareStrokeThicknes, oldValue: previousThickness }
            };
            history.push(action);
            redoStack = [];
            updateUndoRedoButtons();
        }
        console.log("Selected Stroke Thickness:", squareStrokeThicknes);
        event.stopPropagation()
    });
});

// Square Outline Style Selection
squareOutlineStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        const previousOutlineStyle = squareOutlineStyle;
        squareOutlineStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        squareOutlineStyle = span.getAttribute("data-id");

        if (squareElement) {
            const action = {
                type: ACTION_MODIFY,
                element: squareElement,
                data: { property: 'outlineStyle', newValue: squareOutlineStyle, oldValue: previousOutlineStyle }
            };
            history.push(action);
            redoStack = [];
            updateUndoRedoButtons();
        }
        console.log("Selected Outline Style:", squareOutlineStyle);
        event.stopPropagation()
    });
});