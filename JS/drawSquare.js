let squareStrokecolor = "#fff";
let squareBackgroundColor = "#fff";
let squareFillStyleValue = "transparent";
let squareStrokeThicknes = 2;
let squareOutlineStyle = "solid";
let squareElement = null;
let startX, startY;
let SquarecolorOptions = document.querySelectorAll(".squareStrokeSpan");
let backgroundColorOptionsSquare = document.querySelectorAll(".squareBackgroundSpan");
let fillStyleOptions = document.querySelectorAll(".squareFillStyleSpan");
let squareStrokeThicknessValue = document.querySelectorAll(".squareStrokeThickSpan");
let squareOutlineStyleValue = document.querySelectorAll(".squareOutlineStyle");




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
        selectElement(squareElement);
        selectedTool = document.querySelector(".bxs-pointer");
        toolExtraPopup();
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
            squareElement.shape.setAttribute('stroke', squareStrokecolor);

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
             if (squareElement.squareFillStyleValue !== "transparent") {
               squareElement.shape.setAttribute('fill', squareBackgroundColor);
               squareElement.actualFillColor = squareBackgroundColor;
            }

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
          let fillColor = squareBackgroundColor;

          if (squareFillStyleValue === "transparent") {
               fillColor = "rgba(0,0,0,0)";

          }

        if (squareElement) {
              squareElement.shape.setAttribute('fill', fillColor);
              squareElement.actualFillColor = fillColor;
              squareElement.squareFillStyleValue = squareFillStyleValue;

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
            squareElement.shape.setAttribute('strokeWidth', squareStrokeThicknes);

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
              if (squareOutlineStyle === "dashed") {
                  squareElement.shape.setAttribute("stroke-dasharray", "10,10");
              } else if (squareOutlineStyle === "dotted") {
                   squareElement.shape.setAttribute("stroke-dasharray", "2,8");
              } else {
                  squareElement.shape.setAttribute("stroke-dasharray", "");  // Remove dash array for solid
              }

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
        event.stopPropagation();
    });
});