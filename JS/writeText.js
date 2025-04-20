let textElements = [];
let textSize = "30px";
let textFont = "lixFont";
let textColor = "#fff";
let textAlign = "left";

let textColorOptions = document.querySelectorAll(".textColorSpan");
let textFontOptions = document.querySelectorAll(".textFontSpan");
let textSizeOptions = document.querySelectorAll(".textSizeSpan");
let textAlignOptions = document.querySelectorAll(".textAlignSpan");

function getSVGCoordinates(event) {
  let pt = svg.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  let svgPoint = pt.matrixTransform(svg.getScreenCTM().inverse());
  return {
    x: svgPoint.x,
    y: svgPoint.y,
  };
}

// Function to add text wrapped in a group
function addText(event) {
  if (!isTextToolActive || event.button !== 0) return; // Left click only

  let { x, y } = getSVGCoordinates(event);

  // Create a group element to hold the text
  let gElement = document.createElementNS("http://www.w3.org/2000/svg", "g");
  gElement.setAttribute("data-type", "text-group"); // optional marker

  let textElement = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "text"
  );
  let textAlignElement = "start";
  textAlign == "left"
    ? (textAlignElement = "start")
    : null || textAlign == "center"
    ? (textAlignElement = "middle")
    : null || textAlign == "right"
    ? (textAlignElement = "end")
    : null; // Center align text // Center align text

  textElement.setAttribute("x", x);
  textElement.setAttribute("y", y);
  textElement.setAttribute("fill", textColor); // Default white color
  textElement.setAttribute("font-size", textSize); // Size 30px
  textElement.setAttribute("font-family", textFont); // lixFont family
  textElement.setAttribute("text-anchor", textAlignElement); // Center align text
  textElement.setAttribute("cursor", "text");
  textElement.setAttribute("white-space", "pre"); // Important for newline handling
  textElement.textContent = "";

  // Store data for undo/redo
  gElement.setAttribute("data-x", x);
  gElement.setAttribute("data-y", y);
  gElement.setAttribute("data-textColor", textColor);
  gElement.setAttribute("data-textSize", textSize);
  gElement.setAttribute("data-textFont", textFont);
  gElement.setAttribute("data-textAlign", textAlign);

  // Add reference
  gElement.textElement = textElement;

  // Append text to group, then group to SVG
  gElement.appendChild(textElement);
  svg.appendChild(gElement);

  const action = {
    type: ACTION_CREATE,
    element: gElement,
    parent: gElement.parentNode,
    nextSibling: gElement.nextSibling,
    data: {
      x: x,
      y: y,
      textColor: textColor,
      textSize: textSize,
      textFont: textFont,
      textAlign: textAlign,
    },
  };
  history.push(action);
  redoStack = []; // Clear redo stack
  updateUndoRedoButtons();

  // Immediately make the new text element editable
  makeTextEditable(textElement, {x, y});
}

function makeTextEditable(textElement, initialPosition = null) {
  
  console.log("Making text editable");
  let input = document.createElement("textarea"); // Use textarea for multiline editing

  // Extract and reconstruct text with newlines
  let textContent = "";
  for (let i = 0; i < textElement.childNodes.length; i++) {
    let node = textElement.childNodes[i];
    if (node.nodeType === Node.TEXT_NODE) {
      textContent += node.textContent;
    } else if (node.tagName === "tspan") {
      textContent += node.textContent;
      if (i < textElement.childNodes.length - 1) {
        textContent += "\n"; // Add newline between tspans
      }
    }
  }
  input.value = textContent;

  input.style.position = "absolute";
  input.style.boxSizing = "border-box"; // VERY IMPORTANT!
  input.style.border = "none";        // Remove border
  input.style.outline = "none";       // Remove outline
  input.style.padding = "0px";        // Remove padding
  input.style.overflow = "hidden";

  let bbox;

  if (initialPosition) {
    // If it's newly created, use the passed position
    bbox = {
      left: initialPosition.x,
      top: initialPosition.y,
    };
  } else {
    // Get bounding box of the text element in screen coordinates
    bbox = textElement.getBoundingClientRect();
  }

  // Correct positioning
  input.style.left = bbox.left + "px";
  input.style.top = bbox.top + "px";

  // Infinite width:
  input.style.width = "1000px";   // Large width
  input.style.height = bbox.height + "px"; // Initial height

  // Set font properties
  if (initialPosition) {
    // Newly created text
    input.style.fontSize = textSize;
    input.style.fontFamily = textFont;
    input.style.color = textColor;
    input.style.textAlign = textAlign;
  } else {
    // Editing existing text
    input.style.fontSize = textElement.getAttribute("font-size") || "30px";
    input.style.fontFamily = textElement.getAttribute("font-family") || "lixFont";
    input.style.color = textElement.getAttribute("fill") || "#fff";
    input.style.textAlign = textElement.getAttribute("text-anchor") || "left";
  }

  document.body.appendChild(input);

  // Delay focus by 100ms (adjust if needed)
  setTimeout(() => {
    input.focus();
  }, 100);

  // Automatically adjust textarea height
  input.style.height = "auto";
  input.style.height = input.scrollHeight + "px";

  // Clip textarea height if it exceeds canvas height
  const canvasHeight = svg.getBoundingClientRect().bottom; // Get actual height of the SVG element
  const textareaBottom = input.getBoundingClientRect().bottom; // Bottom position of textarea
  console.log(textareaBottom, canvasHeight);
  const maxHeight = canvasHeight - 20; // Maximum height with 20px margin

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      // Insert a newline instead of blurring
      e.preventDefault(); // Prevent default enter behavior
      let start = input.selectionStart;
      let end = input.selectionEnd;
      input.value =
        input.value.substring(0, start) +
        "\n" +
        input.value.substring(end);
      input.selectionStart = input.selectionEnd = start + 1;

      // Adjust textarea height
      input.style.height = "auto";
      input.style.height = input.scrollHeight + "px";
    }
    if (e.key === "Escape") {
      renderText(input, textElement, true); 
    }
  });

  // Store the original text element so we can find the group later
  input.originalTextElement = textElement;

  // Hide the text group
  textElement.parentNode.style.display = "none"; // Hide the group
  input.textGroup = textElement.parentNode;
}


// Function to render the text and group tspans together
function renderText(input, textElement, deleteIfEmpty = false) {
  const text = input.value || "";

  let gElement = textElement.parentNode;

  if (deleteIfEmpty && text.trim() === "") {
    // Delete the group containing the text element if it's empty

    // Check if the element is already removed.
    if (!gElement.parentNode) return; // Prevent errors if already removed

    svg.removeChild(gElement);

    // Remove from history/redo stacks
    const index = history.findIndex((action) => action.element === gElement); // Find action by element
    if (index > -1) {
      history.splice(index, 1);
    }
    updateUndoRedoButtons();
  } else {
    // Clear any existing tspans
    while (textElement.firstChild) {
      textElement.removeChild(textElement.firstChild);
    }

    // Split text by newline and create tspans
    const lines = text.split("\n");
    lines.forEach((line, index) => {
      let tspan = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "tspan"
      );
      tspan.setAttribute("x", textElement.getAttribute("x"));
      tspan.setAttribute("dy", index === 0 ? "0" : "1.2em"); // Adjust line height as needed
      tspan.textContent = line;
      textElement.appendChild(tspan);
    });
  }

  // Make the text group visibile again
  gElement.style.display = 'block';

  document.body.removeChild(input);
  selectedTool = document.querySelector(".bxs-pointer");
  toolExtraPopup();
}

// Find the text element (within a group) at a given position
function findTextElementAtPosition(x, y) {
  // Iterate through all text elements and find one whose x and y attributes
  // match the given position (within a small tolerance).
  const textElements = svg.querySelectorAll("text");
  const tolerance = 5; // Adjust as needed

  for (const textElement of textElements) {
    const textX = parseFloat(textElement.getAttribute("x"));
    const textY = parseFloat(textElement.getAttribute("y"));
    if (Math.abs(textX - x) <= tolerance && Math.abs(textY - y) <= tolerance) {
      return textElement;
    }
  }
  return null; // No matching text element found
}

// Handle mousedown for text creation or editing
handleTextMousedown = function (e) {
  if (selectedTool.classList.contains("bx-text") && e.button === 0) {
    if (e.target && (e.target.tagName === "text" || e.target.tagName === "tspan")) {
      // If clicking on a tspan, use its parent text element
      let textEl = e.target.tagName === "tspan" ? e.target.parentNode : e.target;
      makeTextEditable(textEl);
    } else {
      addText(e);
    }
  } else if (selectedTool.classList.contains("bxs-pointer")) {
    let input = document.querySelector("textarea");
    if (input) {
      
      let textElement = input.originalTextElement;

      if (textElement) {
        renderText(input, textElement, true); // delete if empty
      } else {
        document.body.removeChild(input);
      }
    }
  }
};

svg.addEventListener("mousedown", handleTextMousedown);

textColorOptions.forEach((span) => {
  span.addEventListener("click", (event) => {
    event.stopPropagation(); // Stop event propagation
    const previousColor = textColor;
    textColorOptions.forEach((el) => el.classList.remove("selected"));
    span.classList.add("selected");
    textColor = span.getAttribute("data-id");
    console.log("Selected Text Color:", textColor);

    let input = document.querySelector("textarea");
    if (input) {
      let textElement = input.originalTextElement;
      if (textElement) {
        const action = {
          type: ACTION_MODIFY,
          element: textElement.parentNode,
          data: {
            property: "textColor",
            newValue: textColor,
            oldValue: previousColor,
          },
        };
        history.push(action);
        redoStack = [];
        updateUndoRedoButtons();
      }
    }
  });
});

textFontOptions.forEach((span) => {
  span.addEventListener("click", (event) => {
    event.stopPropagation();
    const previousFont = textFont;
    textFontOptions.forEach((el) => el.classList.remove("selected"));
    span.classList.add("selected");
    textFont = span.getAttribute("data-id");
    console.log("Selected Text Font:", textFont);

    let input = document.querySelector("textarea");
    if (input) {
      let textElement = input.originalTextElement;
      if (textElement) {
        const action = {
          type: ACTION_MODIFY,
          element: textElement.parentNode,
          data: {
            property: "textFont",
            newValue: textFont,
            oldValue: previousFont,
          },
        };
        history.push(action);
        redoStack = [];
        updateUndoRedoButtons();
      }
    }
  });
});

textSizeOptions.forEach((span) => {
  span.addEventListener("click", (event) => {
    event.stopPropagation();
    const previousSize = textSize;
    textSizeOptions.forEach((el) => el.classList.remove("selected"));
    span.classList.add("selected");
    textSize = parseInt(span.getAttribute("data-id"));
    console.log("Selected Text Size:", textSize);

    let input = document.querySelector("textarea");
    if (input) {
      let textElement = input.originalTextElement;
      if (textElement) {
        const action = {
          type: ACTION_MODIFY,
          element: textElement.parentNode,
          data: {
            property: "textSize",
            newValue: textSize,
            oldValue: previousSize,
          },
        };
        history.push(action);
        redoStack = [];
        updateUndoRedoButtons();
      }
    }
  });
});

textAlignOptions.forEach((span) => {
  span.addEventListener("click", (event) => {
    event.stopPropagation();
    const previousAlign = textAlign;
    textAlignOptions.forEach((el) => el.classList.remove("selected"));
    span.classList.add("selected");
    textAlign = span.getAttribute("data-id");
    console.log("Selected Text Align:", textAlign);

    let input = document.querySelector("textarea");
    if (input) {
      let textElement = input.originalTextElement;
      if (textElement) {
        const action = {
          type: ACTION_MODIFY,
          element: textElement.parentNode,
          data: {
            property: "textAlign",
            newValue: textAlign,
            oldValue: previousAlign,
          },
        };
        history.push(action);
        redoStack = [];
        updateUndoRedoButtons();
      }
    }
  });
});