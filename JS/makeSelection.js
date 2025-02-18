function clientToSVG(x, y) {
  const pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y;
  const screenCTM = svg.getScreenCTM();
  if (!screenCTM) {
      console.error("Cannot get screen CTM for SVG.");
      return pt;
  }
  return pt.matrixTransform(screenCTM.inverse());
}

function removeSelectionAnchors() {
  if (selectionAnchors) {
      selectionAnchors.forEach(anchor => {
          if (anchor.parentNode)
              anchor.parentNode.removeChild(anchor);
      });
      selectionAnchors = [];
  }
  const outline = svg.querySelector(".selection-outline");
  if (outline && outline.parentNode)
      outline.parentNode.removeChild(outline);
}

function deselectAll() {
  removeSelectionAnchors();
  selectedElements = [];
}

function addSelectionAnchors(element) {
  removeSelectionAnchors();

  const bbox = element.getBBox();

  // Get the current transform of the element
  let transform = element.getAttribute("transform") || "";
  let translateX = 0,
      translateY = 0;

  // Extract existing translation values
  const translateMatch = transform.match(/translate\(([^)]+)\)/);
  if (translateMatch) {
      const coords = translateMatch[1].split(/[ ,]+/);
      translateX = parseFloat(coords[0]) || 0;
      translateY = parseFloat(coords[1]) || 0;
  }

  const padding = 10; // Size of the padding around selected element

  const anchorPositions = [{
          x: bbox.x + translateX - padding,
          y: bbox.y + translateY - padding,
          cursor: "nw-resize",
          type: "nw"
      },
      {
          x: bbox.x + bbox.width + translateX + padding,
          y: bbox.y + translateY - padding,
          cursor: "ne-resize",
          type: "ne"
      },
      {
          x: bbox.x + bbox.width + translateX + padding,
          y: bbox.y + bbox.height + translateY + padding,
          cursor: "se-resize",
          type: "se"
      },
      {
          x: bbox.x + translateX - padding,
          y: bbox.y + bbox.height + translateY + padding,
          cursor: "sw-resize",
          type: "sw"
      },
      {
          x: bbox.x + bbox.width / 2 + translateX,
          y: bbox.y + translateY - padding - 20,
          cursor: "grab",
          type: "rotate"
      }
  ];

  // Adding the Resizing
  anchorPositions.forEach(pos => {
      const anchor = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      anchor.setAttribute("cx", pos.x);
      anchor.setAttribute("cy", pos.y);
      anchor.setAttribute("r", 7);
      anchor.setAttribute("stroke", "#7875A6");
      anchor.style.cursor = pos.cursor;
      anchor.classList.add("anchor");
      anchor.anchorType = pos.type;
      anchor.addEventListener("pointerdown", anchorPointerDown); // Add listener
      svg.appendChild(anchor);
      selectionAnchors.push(anchor);
  });

  const x = bbox.x + translateX - padding;
  const y = bbox.y + translateY - padding;
  const width = bbox.width + 2 * padding;
  const height = bbox.height + 2 * padding;

  const points = [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height],
      [x, y]
  ];

  const outline = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  outline.setAttribute("points", points.map(pt => pt[0] + "," + pt[1]).join(" "));
  outline.setAttribute("class", "selection-outline");
  outline.setAttribute("stroke", "#7875A6");
  outline.setAttribute("stroke-width", "2"); // Adjust stroke width as needed
  outline.setAttribute("fill", "none");
  outline.style.pointerEvents = "none";
  svg.appendChild(outline);
}


function anchorPointerDown(e) {
  const anchor = e.target;
  if (selectedElements.length !== 1) return;
  const sel = selectedElements[0];

  // Get the initial bounding box and transform values
  const bbox = anchor.initialBBox;
  anchor.startSVG = clientToSVG(e.clientX, e.clientY);  // Set the initial mouse position

  // Set the flag that scaling has started
  isScaling = true;

  // Store initial transform value (including translate, scale, rotate)
  anchor.initialTransform = sel.getAttribute("transform") || 'translate(0, 0) rotate(0) scale(1, 1)';
}

function anchorPointerMove(e) {
  if (!isScaling) return;

  const anchor = e.target;
  const sel = selectedElements[0];
  
  // Get the initial bounding box and transform values
  const bbox = anchor.initialBBox;
  const initialTransform = anchor.initialTransform || 'translate(0, 0) rotate(0) scale(1, 1)';

  // Get the current pointer position in SVG coordinates
  const currentPt = clientToSVG(e.clientX, e.clientY);

  // Calculate the delta in mouse position (movement from the start position)
  const ddx = currentPt.x - anchor.startSVG.x;
  const ddy = currentPt.y - anchor.startSVG.y;

  // Calculate scaling based on movement (scaled by a factor, e.g., 0.005 or another constant)
  const scalingFactor = 0.005;  // Adjust this for faster/slower scaling

  let scaleX = 1, scaleY = 1;
  let originX = 0, originY = 0;

  // Set origin and scaling direction based on the anchor type
  if (anchor.anchorType === "nw") {
      originX = bbox.x + bbox.width;
      originY = bbox.y + bbox.height;
      scaleX = 1 - scalingFactor * ddx;  // Inverse scaling for 'nw' anchor
      scaleY = 1 - scalingFactor * ddy;  // Inverse scaling for 'nw' anchor
  } else if (anchor.anchorType === "ne") {
      originX = bbox.x;
      originY = bbox.y + bbox.height;
      scaleX = 1 + scalingFactor * ddx;  // Normal scaling for 'ne' anchor
      scaleY = 1 - scalingFactor * ddy;  // Inverse scaling for 'ne' anchor
  } else if (anchor.anchorType === "se") {
      originX = bbox.x;
      originY = bbox.y;
      scaleX = 1 + scalingFactor * ddx;  // Normal scaling for 'se' anchor
      scaleY = 1 + scalingFactor * ddy;  // Normal scaling for 'se' anchor
  } else if (anchor.anchorType === "sw") {
      originX = bbox.x + bbox.width;
      originY = bbox.y;
      scaleX = 1 - scalingFactor * ddx;  // Inverse scaling for 'sw' anchor
      scaleY = 1 + scalingFactor * ddy;  // Normal scaling for 'sw' anchor
  }

  // Prevent negative or zero scaling
  if (scaleX <= 0) scaleX = 0.1;
  if (scaleY <= 0) scaleY = 0.1;

  // Parse out existing translate, rotate, and scale values (we will ignore translate)
  let translateX = 0, translateY = 0, rotateAngle = 0;
  let scaleXInit = 1, scaleYInit = 1;

  // Extract translate values (we ignore translate here)
  const translateMatch = initialTransform.match(/translate\s?\(([^)]+)\)/);
  if (translateMatch) {
      const coords = translateMatch[1].split(/[ ,]+/);
      translateX = parseFloat(coords[0]) || 0;
      translateY = parseFloat(coords[1]) || 0;
  }

  // Extract rotate value
  const rotateMatch = initialTransform.match(/rotate\s?\(([^)]+)\)/);
  if (rotateMatch) {
      rotateAngle = parseFloat(rotateMatch[1]) || 0;
  }

  // Extract scale values
  const scaleMatch = initialTransform.match(/scale\s?\(([^)]+)\)/);
  if (scaleMatch) {
      const scales = scaleMatch[1].split(/[ ,]+/);
      scaleXInit = parseFloat(scales[0]) || 1;
      scaleYInit = parseFloat(scales[1]) || scaleXInit; // If only one value is provided, assume it's for both x and y
  }

  // Build the new transform string: Apply scaling, rotate, and keep translate unchanged
  const newTransform = `translate(${translateX}, ${translateY}) rotate(${rotateAngle}, ${bbox.x + bbox.width / 2}, ${bbox.y + bbox.height / 2}) scale(${scaleX * scaleXInit}, ${scaleY * scaleYInit})`;

  // Apply the new transform to the element
  sel.setAttribute("transform", newTransform);

  // Resize the selection rectangle (bounding box) to match the new scaling
  resizeSelectionRectangle(sel, scaleX, scaleY);

  // Remove old anchors and add new ones after scaling
  removeSelectionAnchors();
  addSelectionAnchors(sel);
}

function resizeSelectionRectangle(element, scaleX, scaleY) {
  const bbox = element.getBBox(); // Get the current bounding box
  const newWidth = bbox.width * scaleX;
  const newHeight = bbox.height * scaleY;

  // Update the size of the selection rectangle (assuming you have a rect element for selection)
  const selectionRect = document.getElementById('selection-rect'); // Replace with your actual selection rectangle element ID

  selectionRect.setAttribute('width', newWidth);
  selectionRect.setAttribute('height', newHeight);
  selectionRect.setAttribute('x', bbox.x + (bbox.width - newWidth) / 2); // Adjust x based on scaling
  selectionRect.setAttribute('y', bbox.y + (bbox.height - newHeight) / 2); // Adjust y based on scaling
}

function anchorPointerMove(e) {
  const anchor = e.target;
  if (selectedElements.length !== 1) return;
  const sel = selectedElements[0];

  // Get the initial bounding box and transform values
  const bbox = anchor.initialBBox;
  const initialTransform = anchor.initialTransform || 'translate(0, 0) rotate(0) scale(1, 1)';

  // Get the current pointer position in SVG coordinates
  const currentPt = clientToSVG(e.clientX, e.clientY);

  // Calculate the delta in mouse position (movement from the start position)
  const ddx = currentPt.x - anchor.startSVG.x;
  const ddy = currentPt.y - anchor.startSVG.y;

  // Log the mouse movement
  console.log(`Mouse moved: dx = ${ddx}, dy = ${ddy}`);

  // Calculate scaling based on movement (scaled by a factor, e.g., 0.1 or another constant)
  const scalingFactor = 0.005;  // Adjust this for faster/slower scaling

  let scaleX = 1, scaleY = 1;
  let originX = 0, originY = 0;

  // Set origin and scaling direction based on the anchor type
  if (anchor.anchorType === "nw") {
      originX = bbox.x + bbox.width;
      originY = bbox.y + bbox.height;
      scaleX = 1 - scalingFactor * ddx;  // Inverse scaling for 'nw' anchor
      scaleY = 1 - scalingFactor * ddy;  // Inverse scaling for 'nw' anchor
  } else if (anchor.anchorType === "ne") {
      originX = bbox.x;
      originY = bbox.y + bbox.height;
      scaleX = 1 + scalingFactor * ddx;  // Normal scaling for 'ne' anchor
      scaleY = 1 - scalingFactor * ddy;  // Inverse scaling for 'ne' anchor
  } else if (anchor.anchorType === "se") {
      originX = bbox.x;
      originY = bbox.y;
      scaleX = 1 + scalingFactor * ddx;  // Normal scaling for 'se' anchor
      scaleY = 1 + scalingFactor * ddy;  // Normal scaling for 'se' anchor
  } else if (anchor.anchorType === "sw") {
      originX = bbox.x + bbox.width;
      originY = bbox.y;
      scaleX = 1 - scalingFactor * ddx;  // Inverse scaling for 'sw' anchor
      scaleY = 1 + scalingFactor * ddy;  // Normal scaling for 'sw' anchor
  }

  // Prevent negative or zero scaling
  if (scaleX <= 0) scaleX = 0.1;
  if (scaleY <= 0) scaleY = 0.1;

  // Parse out existing translate, rotate, and scale values (we will ignore translate)
  let translateX = 0, translateY = 0, rotateAngle = 0;
  let scaleXInit = 1, scaleYInit = 1;

  // Extract translate values (we ignore translate here)
  const translateMatch = initialTransform.match(/translate\s?\(([^)]+)\)/);
  if (translateMatch) {
      const coords = translateMatch[1].split(/[ ,]+/);
      translateX = parseFloat(coords[0]) || 0;
      translateY = parseFloat(coords[1]) || 0;
  }

  // Extract rotate value
  const rotateMatch = initialTransform.match(/rotate\s?\(([^)]+)\)/);
  if (rotateMatch) {
      rotateAngle = parseFloat(rotateMatch[1]) || 0;
  }

  // Extract scale values
  const scaleMatch = initialTransform.match(/scale\s?\(([^)]+)\)/);
  if (scaleMatch) {
      const scales = scaleMatch[1].split(/[ ,]+/);
      scaleXInit = parseFloat(scales[0]) || 1;
      scaleYInit = parseFloat(scales[1]) || scaleXInit; // If only one value is provided, assume it's for both x and y
  }

  // Build the new transform string: Apply scaling, rotate, and keep translate unchanged
  const newTransform = `translate(${translateX}, ${translateY}) rotate(${rotateAngle}, ${bbox.x + bbox.width / 2}, ${bbox.y + bbox.height / 2}) scale(${scaleX * scaleXInit}, ${scaleY * scaleYInit})`;

  // Apply the new transform to the element
  sel.setAttribute("transform", newTransform);

  // Remove old anchors and add new ones after scaling
  removeSelectionAnchors();
  addSelectionAnchors(sel);
}





function rotatePointerMove(e) {
  const anchor = e.target;
  if (selectedElements.length !== 1) return;

  const sel = selectedElements[0];
  const currentPt = clientToSVG(e.clientX, e.clientY);

  // Get the center of the element (this can be the bbox center)
  const bbox = anchor.initialBBox; // initial bounding box of the element
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;

  // Calculate the movement relative to the center of the element
  const dx = currentPt.x - cx;
  const dy = currentPt.y - cy;

  // Compute rotation angle from current pointer position
  let angle = Math.atan2(dy, dx); // Angle in radians

  // If this is the first movement, set the initial rotation angle
  if (typeof anchor.initialAngle === 'undefined') {
      anchor.initialAngle = angle;
  }

  // Calculate the delta angle between the initial angle and current angle
  let deltaAngle = angle - anchor.initialAngle;

  // Increment rotation by a small factor (0.1 radians per drag event)
  deltaAngle = Math.round(deltaAngle / 0.1) * 0.1; // Ensure increment of 0.1 radians

  // Apply the new rotation angle
  const initialTransform = anchor.initialTransform || "";
  let translateX = 0;
  let translateY = 0;
  let initialRotate = 0;

  // Extract translate values
  const translateMatch = initialTransform.match(/translate\(([^)]+)\)/);
  if (translateMatch) {
      const coords = translateMatch[1].split(/[ ,]+/);
      translateX = parseFloat(coords[0]) || 0;
      translateY = parseFloat(coords[1]) || 0;
  }

  // Extract previous rotation
  const rotateMatch = initialTransform.match(/rotate\(([^)]+)\)/);
  if (rotateMatch) {
      initialRotate = parseFloat(rotateMatch[1]) || 0;
  }

  // Combine the initial translate, the cumulative rotation, and the current position
  const newTransform = `translate(${translateX}, ${translateY}) rotate(${initialRotate + deltaAngle * 180 / Math.PI}, ${cx}, ${cy})`;

  // Set the new transform to the element
  sel.setAttribute("transform", newTransform);

  // Update the initial rotation angle for the next pointermove event
  anchor.initialAngle = angle;

  // Remove old anchors and add new ones after rotation
  removeSelectionAnchors();
  addSelectionAnchors(sel);
}


function anchorPointerUp(e) {
  e.target.releasePointerCapture(e.pointerId);
  isScaling = false;
  // Add pointer events for scaling this anchor.
  e.target.removeEventListener("pointermove", anchorPointerMove);
  e.target.removeEventListener("pointermove", rotatePointerMove);
  e.target.removeEventListener("pointerup", anchorPointerUp);
}

// =====================
// Selection & Repositioning Handlers

function selectElement(el, addToSelection = false) {
  if (!addToSelection) {
      deselectAll();
  }
  if (!selectedElements.includes(el)) {
      selectedElements.push(el);
  }
  if (selectedElements.length === 1) {
      addSelectionAnchors(el);
  }
}



svg.addEventListener("pointerdown", function (e) {
  if (!selectedTool.classList.contains("bxs-pointer")) return;

  // If clicking on an anchor, let its handler take over.
  if (e.target.classList.contains("anchor")) return;


  let targetElem = e.target;
  let found = null;
  console.log(targetElem.tagName);
  // If clicking on the SVG background, search for an element.
  if (targetElem.tagName === "svg") {
      deselectAll(); // Deselect if clicking on the SVG background.
      return; //stop process
  }

  const pt = clientToSVG(e.clientX, e.clientY);
  const elements = Array.from(svg.querySelectorAll("g, path, rect"));
  found = elements.find(el => {
      const bbox = el.getBBox();
      return (
          pt.x >= bbox.x - 20 &&
          pt.x <= bbox.x + bbox.width + 20 &&
          pt.y >= bbox.y - 20 &&
          pt.y <= bbox.y + bbox.height + 20
      );
  });

  if (!found) {
      if (
          targetElem.tagName === "g" ||
          targetElem.tagName === "path" ||
          targetElem.tagName === "rect"
      ) {
          found = targetElem;
      }
  }
  // If a child element is clicked, try to select its parent <g>.
  if (targetElem.tagName === "rect") {
      found = targetElem.parentNode;
  } else if (targetElem.tagName === "path" && targetElem.parentNode.tagName === "g") {
      found = targetElem.parentNode;
  } else {
      found = targetElem;
  }
  if (found) {
      const addToSelection = e.ctrlKey || e.metaKey;
      selectElement(found, addToSelection);
      // Start dragging the selected element.
      isDraggingSelected = true;
      dragStartPoint = clientToSVG(e.clientX, e.clientY);
      initialPositions = selectedElements.map(el => {
          let transform = el.getAttribute("transform") || "";
          let match = transform.match(/translate\(([^)]+)\)/);
          if (match) {
              const coords = match[1].split(/[ ,]+/);
              return {
                  x: parseFloat(coords[0]),
                  y: parseFloat(coords[1])
              };
          }
          return {
              x: 0,
              y: 0
          };
      });
      return;
  } else {
      // No element found: Deselect
      deselectAll();
  }
});


svg.addEventListener("pointermove", function (e) {
  if (!selectedTool.classList.contains("bxs-pointer")) return;

  if (isDraggingSelected) {
      const currentPt = clientToSVG(e.clientX, e.clientY);
      const dx = currentPt.x - dragStartPoint.x;
      const dy = currentPt.y - dragStartPoint.y;
      selectedElements.forEach((el, i) => {
          const init = initialPositions[i];
          el.setAttribute("transform", `translate(${init.x + dx}, ${init.y + dy})`);
      });
      if (selectedElements.length === 1) {
          removeSelectionAnchors();
          addSelectionAnchors(selectedElements[0]);
      }
  }
});

svg.addEventListener("pointerup", function (e) {
  if (!selectedTool.classList.contains("bxs-pointer")) return;
  isDraggingSelected = false;
  dragStartPoint = null;
  initialPositions = [];
});