// --- Event Handlers ---

function handleStrokeColorSelection(event) {
    strokeColors.forEach(s => s.classList.remove("selected"));
    event.target.classList.add("selected");
    strokeColor = event.target.getAttribute("data-id");
    console.log("Selected Color:", strokeColor);
}

function handleStrokeThicknessSelection(event) {
    strokeThicknesses.forEach(t => t.classList.remove("selected"));
    event.target.classList.add("selected");
    strokeThickness = parseInt(event.target.getAttribute("data-id"));
    console.log("Selected Thickness:", strokeThickness);
}

function handleToolSelection(event) {
    tools.forEach(t => t.classList.remove("selected"));
    const tool = event.target;
    tool.classList.add("selected");
    selectedTool = tool;
    isSquareToolActive = tool.classList.contains("bx-square");
    toolExtraPopup();
}

// Square Stroke Color Selection
colorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation(); // Stop event propagation
        colorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        squareStrokecolor = span.getAttribute("data-id");
        console.log("Selected Stroke Color:", squareStrokecolor);
    });
});

// Square Background Color Selection
backgroundColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation(); // Stop event propagation
        backgroundColorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        squareBackgroundColor = span.getAttribute("data-id");
        console.log("Selected Background Color:", squareBackgroundColor);
    });
});

// Square Fill Style Selection
fillStyleOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        fillStyleOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        squareFillStyleValue = span.getAttribute("data-id");
        console.log("Selected Fill Style:", squareFillStyleValue);
        event.stopPropagation()
    });
});

// Square Stroke Thickness Selection
squareStrokeThicknessValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        squareStrokeThicknessValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        squareStrokeThicknes = parseInt(span.getAttribute("data-id"));
        console.log("Selected Stroke Thickness:", squareStrokeThicknes);
        event.stopPropagation()
    });
});

// Square Outline Style Selection
squareOutlineStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        squareOutlineStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        squareOutlineStyle = span.getAttribute("data-id");
        console.log("Selected Outline Style:", squareOutlineStyle);
        event.stopPropagation()
    });
});




function handlePointerDown(e) {
    if (isSquareToolActive) {
        startX = e.clientX;
        startY = e.clientY;

        // Initialize squareElement to null here before drawing a new one
        squareElement = null;

        svg.addEventListener('pointermove', handlePointerMove); // Start tracking movement
    }
    else if (selectedTool.classList.contains("bxs-paint")) {
        points = [[e.clientX, e.clientY, e.pressure]];
        currentPath = createNewPathElement();
        svg.appendChild(currentPath); // Append the new path immediately
        renderStroke();
        svg.addEventListener('pointermove', handlePointerMove);
    }
}


function handlePointerMove(e) {
    if (isSquareToolActive) {
        const width = e.clientX - startX;
        const height = e.clientY - startY;
        drawSquare(startX, startY, width, height);
    }
    else if (e.buttons === 1 && selectedTool.classList.contains("bxs-paint")) {
        points.push([e.clientX, e.clientY, e.pressure]);
        renderStroke();
    }
}


function handlePointerUp() {
    svg.removeEventListener("pointermove", handlePointerMove);

    if (isSquareToolActive && squareElement) {
        history.push(squareElement); // Store the square element
        squareElement = null;       // Reset squareElement after pushing it into history
    }
    else if (currentPath) {
        history.push(currentPath);
        currentPath = null;

    }

    points = [];
    redoStack = [];
    updateUndoRedoButtons();
}


// --- Event Listeners ---
strokeColors.forEach(stroke => stroke.addEventListener("click", handleStrokeColorSelection));
strokeThicknesses.forEach(thickness => thickness.addEventListener("click", handleStrokeThicknessSelection));
tools.forEach(tool => tool.addEventListener("click", handleToolSelection));


svg.addEventListener('pointerdown', handlePointerDown);
svg.addEventListener('pointerup', handlePointerUp);



// --- Initialization ---
window.onload = () => {
    toolExtraPopup();
    updateUndoRedoButtons();
};