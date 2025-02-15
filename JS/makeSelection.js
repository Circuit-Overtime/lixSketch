function clientToSVG(x, y) {
    const pt = svg.createSVGPoint();
    pt.x = x;
    pt.y = y;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }
  
  function removeSelectionAnchors() {
      if (selectionAnchors) {
          selectionAnchors.forEach(anchor => {
              if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
          });
          selectionAnchors = [];
      }
      const outline = svg.querySelector(".selection-outline");
      if (outline && outline.parentNode) outline.parentNode.removeChild(outline);
  }
  
  function deselectAll() {
      removeSelectionAnchors();
      selectedElements = [];
  }
  
  function addSelectionAnchors(element) {
      removeSelectionAnchors();
  
      const bbox = element.getBBox();
  
      let transform = element.getAttribute("transform") || "";
      let translateX = 0,
          translateY = 0;
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
          anchor.setAttribute("cx", pos.x + (pos.type === "ne" || pos.type === "se" ? 10 : 0));
        anchor.setAttribute("cx", pos.x - (pos.type === "nw" || pos.type === "sw" ? 10 : 0));
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
        e.stopPropagation(); // Prevent triggering drag on the element.
        const anchor = e.target;
        // Record initial pointer position in SVG coordinates.
        const startPt = clientToSVG(e.clientX, e.clientY);
        anchor.startSVG = {
            x: startPt.x,
            y: startPt.y
        };
    
        // Only support resizing for single selection.
        if (selectedElements.length !== 1) return;
        const sel = selectedElements[0];
        // Use the element's untransformed bounding box.
        anchor.initialBBox = sel.getBBox();
    
        // Record any existing translation.
        let transform = sel.getAttribute("transform") || "";
        let match = transform.match(/translate\(([^)]+)\)/);
        anchor.initialTransform = {
            x: 0,
            y: 0
        };
        if (match) {
            const coords = match[1].split(/[ ,]+/);
            anchor.initialTransform = {
                x: parseFloat(coords[0]),
                y: parseFloat(coords[1])
            };
        }
    
        // Also store the anchor's initial position (in SVG coordinates as set earlier).
        anchor.initialCX = parseFloat(anchor.getAttribute("cx"));
        anchor.initialCY = parseFloat(anchor.getAttribute("cy"));
    
        // Add pointer events for scaling this anchor.
        if (anchor.anchorType !== "rotate") {
            anchor.addEventListener("pointermove", anchorPointerMove);
        } else {
            anchor.addEventListener("pointermove", rotatePointerMove);
        }
        anchor.addEventListener("pointerup", anchorPointerUp);
        anchor.setPointerCapture(e.pointerId);
    }
  
  function anchorPointerMove(e) {
      const anchor = e.target;
      if (selectedElements.length !== 1) return;
      const sel = selectedElements[0];
      const bbox = anchor.initialBBox; // Untransformed bounding box
      const currentPt = clientToSVG(e.clientX, e.clientY);
  
      // Compute delta in SVG coordinates relative to anchor's initial position.
      const ddx = currentPt.x - anchor.startSVG.x;
      const ddy = currentPt.y - anchor.startSVG.y;
  
      let scaleX = 1,
          scaleY = 1;
      let origin = {
          x: 0,
          y: 0
      };
      // Based on the anchor type, calculate scale and fixed corner (origin).
      if (anchor.anchorType === "nw") {
          origin = {
              x: bbox.x + bbox.width + anchor.initialTransform.x,
              y: bbox.y + bbox.height + anchor.initialTransform.y
          };
          scaleX = (bbox.width - ddx) / bbox.width;
          scaleY = (bbox.height - ddy) / bbox.height;
      } else if (anchor.anchorType === "ne") {
          origin = {
              x: bbox.x + anchor.initialTransform.x,
              y: bbox.y + bbox.height + anchor.initialTransform.y
          };
          scaleX = (bbox.width + ddx) / bbox.width;
          scaleY = (bbox.height - ddy) / bbox.height;
      } else if (anchor.anchorType === "se") {
          origin = {
              x: bbox.x + anchor.initialTransform.x,
              y: bbox.y + anchor.initialTransform.y
          };
          scaleX = (bbox.width + ddx) / bbox.width;
          scaleY = (bbox.height + ddy) / bbox.height;
      } else if (anchor.anchorType === "sw") {
          origin = {
              x: bbox.x + bbox.width + anchor.initialTransform.x,
              y: bbox.y + anchor.initialTransform.y
          };
          scaleX = (bbox.width - ddx) / bbox.width;
          scaleY = (bbox.height + ddy) / bbox.height;
      }
  
      // Prevent negative or zero scaling.
      if (scaleX <= 0) scaleX = 0.1;
      if (scaleY <= 0) scaleY = 0.1;
  
      // Apply scaling and keep the origin in the same place
      const initT = anchor.initialTransform;
      const newTransform = `translate(${origin.x}, ${origin.y}) scale(${scaleX}, ${scaleY}) translate(${-origin.x + initT.x}, ${-origin.y + initT.y})`;
      sel.setAttribute("transform", newTransform);
  
      // Update anchors.
      removeSelectionAnchors();
      addSelectionAnchors(sel);
  }
   function rotatePointerMove(e) {
      const anchor = e.target;
      if (selectedElements.length !== 1) return;
  
      const sel = selectedElements[0];
      const currentPt = clientToSVG(e.clientX, e.clientY);
  
      // Center of element = x + width/2 , y + height/2
      const bbox = anchor.initialBBox; // initial bounding box of the element
      const dx = currentPt.x - anchor.initialBBox.x - anchor.initialBBox.width/2;
      const dy = currentPt.y - anchor.initialBBox.y - anchor.initialBBox.height/2;
  
      // Compute rotation angle.
      let angle = Math.atan2(dy, dx) * 180 / Math.PI;
  
      // Apply rotation to the element
      sel.setAttribute("transform", `rotate(${angle}, ${anchor.initialBBox.x + anchor.initialBBox.width/2}, ${anchor.initialBBox.y + anchor.initialBBox.height/2})`);
      // Update anchors.
      removeSelectionAnchors();
      addSelectionAnchors(sel);
  }
    
      function anchorPointerUp(e) {
        e.target.releasePointerCapture(e.pointerId);
    
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
              return { x: parseFloat(coords[0]), y: parseFloat(coords[1]) };
            }
            return { x: 0, y: 0 };
          });
          return;
        } else {
          // No element found: Deselect
            deselectAll();
        }
      });
      
      
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