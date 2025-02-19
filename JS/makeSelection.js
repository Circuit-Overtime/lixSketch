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
  

  function deselectAll() {
    removeSelectionAnchors();
    selectedElements = [];
  }
  
  
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
  
  
  
  svg.addEventListener("pointerdown", function(e) {
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
  
    // Handle clicks on text elements (tspan or text)
    if (targetElem.tagName === "tspan" || targetElem.tagName === "text") {
      found = targetElem.closest("g[data-type='text-group']");
      if (found) {
        const addToSelection = e.ctrlKey || e.metaKey;
        selectElement(found, addToSelection);
        startDragging(e, found);
        return;
      }
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
      startDragging(e, found);
      return;
    } else {
      // No element found: Deselect
      deselectAll();
    }
  });
  
  function startDragging(e, element) {
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
  }
  
  
  svg.addEventListener("pointermove", function(e) {
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
  
  svg.addEventListener("pointerup", function(e) {
    if (!selectedTool.classList.contains("bxs-pointer")) return;
    isDraggingSelected = false;
    dragStartPoint = null;
    initialPositions = [];
  });