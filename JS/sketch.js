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
    isCircleToolActive = tool.classList.contains("bx-circle");
    isArrowToolActive = tool.classList.contains("bx-right-arrow-alt");
    isTextToolActive = tool.classList.contains("bx-text");
    toolExtraPopup();
}


// =========================================================================================================
// Square Stroke Color Selection
SquarecolorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation(); // Stop event propagation
        SquarecolorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        squareStrokecolor = span.getAttribute("data-id");
        console.log("Selected Stroke Color:", squareStrokecolor);
    });
});

// Square Background Color Selection
backgroundColorOptionsSquare.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation(); // Stop event propagation
        backgroundColorOptionsSquare.forEach((el) => el.classList.remove("selected"));
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

// =========================================================================================
//for circle 
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
// ==========================================================================================================
//for the arrow 
arrowStrokeColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation(); // Stop event propagation
        arrowStrokeColorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowStrokeColor = span.getAttribute("data-id");
        console.log("Selected Stroke Color:", arrowStrokeColor);
    });
});

arrowStrokeThicknessValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        arrowStrokeThicknessValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowStrokeThickness = parseInt(span.getAttribute("data-id"));
        console.log("Selected Stroke Thickness:", arrowStrokeThickness);
        event.stopPropagation()
    });
});

arrowOutlineStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        arrowOutlineStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowOutlineStyle = span.getAttribute("data-id");
        console.log("Selected Outline Style:", arrowOutlineStyle);
        event.stopPropagation()
    });
  });

  arrowTypeStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        arrowTypeStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowCurved = span.getAttribute("data-id");
        console.log("Selected Arrow Style:", arrowCurved);
        event.stopPropagation()
    });
  });

  arrowHeadStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        arrowHeadStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowHeadStyle = span.getAttribute("data-id");
        console.log("Selected Arrow Head Style:", arrowHeadStyle);
        event.stopPropagation()
    });
  });

//zoom funtionality 



// --- Merged Pointer Event Handlers ---

function handlePointerDown(e) {
  if (isArrowToolActive) {
    if (arrowElementGroup) {
      svg.removeChild(arrowElementGroup);
      arrowElementGroup = null;
    }
    if (arrowCurved) {
      arrowPoints = [];
      arrowPoints.push({ x: e.clientX, y: e.clientY });
    } else {
      arrowStartX = e.clientX;
      arrowStartY = e.clientY;
    }
    svg.addEventListener("pointermove", handlePointerMove);
  }
    // Square Tool
    else if (isSquareToolActive) {
      startX = e.clientX;
      startY = e.clientY;
      // Initialize squareElement to null before drawing a new one
      squareElement = null;
      svg.addEventListener("pointermove", handlePointerMove);
    }
    // Circle Tool
    else if (isCircleToolActive) {
      circleStartX = e.clientX;
      circleStartY = e.clientY;
      // Remove any existing preview circle
      if (circleElement) {
        svg.removeChild(circleElement);
        circleElement = null;
      }
      svg.addEventListener("pointermove", handlePointerMove);
    }
    // Freehand/Paint Brush Tool
    else if (selectedTool.classList.contains("bxs-paint")) {
      points = [[e.clientX, e.clientY, e.pressure]];
      currentPath = createNewPathElement();
      svg.appendChild(currentPath); // Append the new path immediately
      renderStroke();
      svg.addEventListener("pointermove", handlePointerMove);
    }
  }


  function handlePointerMove(e) {

    if (isArrowToolActive) {
      if (arrowCurved) {
        arrowPoints.push({ x: e.clientX, y: e.clientY });
        drawArrowFromPoints(arrowPoints);
      } else {
        drawArrow(arrowStartX, arrowStartY, e.clientX, e.clientY);
      }
    }
    // Square Tool: Draw preview square
    else if (isSquareToolActive) {
      const width = e.clientX - startX;
      const height = e.clientY - startY;
      drawSquare(startX, startY, width, height);
    }
    // Circle Tool: Draw preview circle
    else if (isCircleToolActive) {
      // Here we're using the function that grows the circle from the pointer origin
      drawCircleFromOrigin(circleStartX, circleStartY, e.clientX, e.clientY);
    }
    // Freehand/Paint Brush Tool: Render stroke
    else if (selectedTool.classList.contains("bxs-paint")) {
      points.push([e.clientX, e.clientY, e.pressure]);
      renderStroke();
    }


    
  }
  
  function handlePointerUp(e) {
    // Remove pointermove listener from all tools
    svg.removeEventListener("pointermove", handlePointerMove);
  

    if (isArrowToolActive) {
      if (arrowCurved) {
        drawArrowFromPoints(arrowPoints);
        if (arrowElementGroup) {
          history.push(arrowElementGroup);
          arrowElementGroup = null;
        }
      } else {
        drawArrow(arrowStartX, arrowStartY, e.clientX, e.clientY);
        if (arrowElementGroup) {
          history.push(arrowElementGroup);
          arrowElementGroup = null;
        }
      }
    }
    
    // Finalize Square Tool
    else if (isSquareToolActive && squareElement) {
      history.push(squareElement); // Store the square element
      squareElement = null;        // Reset after pushing to history
    }
    // Finalize Circle Tool
    else if (isCircleToolActive && circleElement) {
      history.push(circleElement);
      circleElement = null;
    }
    // Finalize Freehand/Paint Brush Tool
    else if (currentPath) {
      history.push(currentPath);
      currentPath = null;
    }

    
  
    // Reset points for freehand drawing and clear redo stack
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


resizeCanvas();
// --- Initialization ---
window.onload = () => {
    toolExtraPopup();
    updateUndoRedoButtons();
    resizeCanvas();
};