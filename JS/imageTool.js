import { pushCreateAction, pushDeleteAction, pushTransformAction } from './undoAndRedo.js';

let isDraggingImage = false;
let imageToPlace = null;
let imageX = 0;
let imageY = 0;
let scaleFactor = 0.2; 
let currentImageElement = null; 

let selectedImage = null;
let originalX, originalY, originalWidth, originalHeight;
let currentAnchor = null; 
let isDragging = false;
let isRotatingImage = false;
let dragOffsetX, dragOffsetY;
let startRotationMouseAngle = null;
let startImageRotation = null;
let imageRotation = 0;
let aspect_ratio_lock = true;
const minImageSize = 20; // Renamed from MIN_IMAGE_SIZE

document.getElementById("importImage").addEventListener('click', () => {
    console.log('Import image clicked');
    isImageToolActive = true;
    console.log('isImageToolActive set to:', isImageToolActive);

    // Try different image paths - adjust based on your file structure
    const hardcodedImagePath = 'test.jpg'; // Remove the './' 
    // Or try: '/test.jpg' or 'Images/test.jpg' depending on your folder structure
    loadHardcodedImage(hardcodedImagePath);
});

const loadHardcodedImage = (imagePath) => {
    console.log('Loading hardcoded image:', imagePath);
    const img = new Image();
    img.onload = () => {
        console.log('Image loaded successfully');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        imageToPlace = canvas.toDataURL();
        isDraggingImage = true;
        console.log('Image ready to place, isDraggingImage:', isDraggingImage);
    };
    img.onerror = (error) => {
        console.error('Failed to load the hardcoded image:', error);
        console.error('Image path:', imagePath);
    };
    img.src = imagePath;
};

const handleImageUpload = (file) => {
    if (!file || !isImageToolActive) return; // Also check isImageToolActive

    const reader = new FileReader();
    reader.onload = (e) => {
        imageToPlace = e.target.result; // The data URL itself becomes the image source
        isDraggingImage = true;
    };
    reader.readAsDataURL(file);
};

// Event handler for mousemove on the SVG
const handleMouseMoveImage = (e) => {
    if (!isDraggingImage || !imageToPlace || !isImageToolActive) return; // Also check isImageToolActive

    // Get mouse coordinates relative to the SVG element
    const rect = svg.getBoundingClientRect();
    imageX = e.clientX - rect.left;
    imageY = e.clientY - rect.top;

    drawMiniatureImage();
};

const drawMiniatureImage = () => {
    if (!isDraggingImage || !imageToPlace || !isImageToolActive) return; // Also check isImageToolActive

    const miniatureWidth = 100; // Fixed width for miniature (adjust as needed)
    getImageAspectRatio(imageToPlace)
        .then(aspectRatio => {
            const miniatureHeight = miniatureWidth * aspectRatio;  // Maintain aspect ratio

            // Remove the previous miniature image, if it exists
            if (currentImageElement) {
                svg.removeChild(currentImageElement);
                currentImageElement = null; // Important: clear the reference
            }

            // Create an SVG image element for the miniature
            currentImageElement = document.createElementNS("http://www.w3.org/2000/svg", "image");
            currentImageElement.setAttribute("href", imageToPlace);
            currentImageElement.setAttribute("x", imageX - miniatureWidth / 2); 
            currentImageElement.setAttribute("y", imageY - miniatureHeight / 2);
            currentImageElement.setAttribute("width", miniatureWidth);
            currentImageElement.setAttribute("height", miniatureHeight);
            currentImageElement.setAttribute("preserveAspectRatio", "xMidYMid meet");

            svg.appendChild(currentImageElement);
        })
        .catch(error => {
            console.error("Error getting aspect ratio:", error);
            
        });
};

function getImageAspectRatio(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve(img.height / img.width);
        };
        img.onerror = () => {
            reject(new Error('Failed to load image for aspect ratio calculation.'));
        };
        img.src = dataUrl;
    });
}

const handleMouseDownImage = async (e) => {
    if (!isDraggingImage || !imageToPlace || !isImageToolActive) {
        // Handle image selection if selection tool is active
        if (isSelectionToolActive) {
            const clickedImage = e.target.closest('image');
            if (clickedImage) {
                selectImage({ target: clickedImage, stopPropagation: () => e.stopPropagation() });
                return;
            }
        }
        return;
    }

    try {
        //Get aspect ratio before we clear the temporary image data.
        let aspectRatio = await getImageAspectRatio(imageToPlace);

        // Remove the miniature
        if (currentImageElement) {
            svg.removeChild(currentImageElement);
            currentImageElement = null;
        }

        // Calculate actual dimensions of the placed image
        const placedImageWidth = 200; // Adjust as needed
        const placedImageHeight = placedImageWidth * aspectRatio;

        //Get mouse coordinates relative to the SVG element
        const rect = svg.getBoundingClientRect();
        let placedX = e.clientX - rect.left;
        let placedY = e.clientY - rect.top;

        // Create a new SVG image element for the final image
        const finalImage = document.createElementNS("http://www.w3.org/2000/svg", "image");
        finalImage.setAttribute("href", imageToPlace);
        finalImage.setAttribute("x", placedX - placedImageWidth / 2);
        finalImage.setAttribute("y", placedY - placedImageHeight / 2);
        finalImage.setAttribute("width", placedImageWidth);
        finalImage.setAttribute("height", placedImageHeight);
        finalImage.setAttribute("preserveAspectRatio", "xMidYMid meet");

        // Store data for undo/redo
        finalImage.setAttribute('data-href', imageToPlace);
        finalImage.setAttribute('data-x', placedX - placedImageWidth / 2);
        finalImage.setAttribute('data-y', placedY - placedImageHeight / 2);
        finalImage.setAttribute('data-width', placedImageWidth);
        finalImage.setAttribute('data-height', placedImageHeight);

        svg.appendChild(finalImage);

        // Add to undo stack for image creation
        pushCreateAction({
            type: 'image',
            element: finalImage,
            remove: () => {
                if (finalImage.parentNode) {
                    finalImage.parentNode.removeChild(finalImage);
                }
            },
            restore: () => {
                svg.appendChild(finalImage);
            }
        });

        // Add click event to the newly added image
        finalImage.addEventListener('click', selectImage);

    } catch (error) {
        console.error("Error placing image:", error);
        isDraggingImage = false;
        imageToPlace = null;
        isImageToolActive = false; // Important: Reset the tool state.
    } finally {

        isDraggingImage = false;
        imageToPlace = null;
        isImageToolActive = false; // Important: Reset the tool state.
    }
};

const handleMouseUpImage = (e) => {
    // Handle image deselection when clicking outside
    if (isSelectionToolActive) {
        // Check if we clicked on an image or image-related element
        const clickedElement = e.target;
        const isImageElement = clickedElement.tagName === 'image';
        const isAnchorElement = clickedElement.classList.contains('resize-anchor') || 
                               clickedElement.classList.contains('rotation-anchor') ||
                               clickedElement.classList.contains('selection-outline');
        
        // If we didn't click on an image or its controls, deselect
        if (!isImageElement && !isAnchorElement && selectedImage) {
            removeSelectionOutline();
            selectedImage = null;
        }
    }
};

function selectImage(event) {
    if (!isSelectionToolActive) return;

    event.stopPropagation(); // Prevent click from propagating to the SVG

    if (selectedImage) {
        removeSelectionOutline();
    }

    selectedImage = event.target;
    
    // Get the current rotation from the image transform attribute
    const transform = selectedImage.getAttribute('transform');
    if (transform) {
        const rotateMatch = transform.match(/rotate\(([^,]+)/);
        if (rotateMatch) {
            imageRotation = parseFloat(rotateMatch[1]);
        }
    } else {
        imageRotation = 0;
    }
    
    addSelectionOutline();

    // Store original dimensions for resizing
    originalX = parseFloat(selectedImage.getAttribute('x'));
    originalY = parseFloat(selectedImage.getAttribute('y'));
    originalWidth = parseFloat(selectedImage.getAttribute('width'));
    originalHeight = parseFloat(selectedImage.getAttribute('height'));

     // Add drag event listeners to the selected image
     selectedImage.addEventListener('mousedown', startDrag);
     selectedImage.addEventListener('mouseup', stopDrag);
     selectedImage.addEventListener('mouseleave', stopDrag); //Stop drag if mouse leaves the image
}

function addSelectionOutline() {
    if (!selectedImage) return;

    const x = parseFloat(selectedImage.getAttribute('x'));
    const y = parseFloat(selectedImage.getAttribute('y'));
    const width = parseFloat(selectedImage.getAttribute('width'));
    const height = parseFloat(selectedImage.getAttribute('height'));

    const selectionPadding = 8; // Padding around the selection
    const expandedX = x - selectionPadding;
    const expandedY = y - selectionPadding;
    const expandedWidth = width + 2 * selectionPadding;
    const expandedHeight = height + 2 * selectionPadding;

    // Create a dashed outline
    const outlinePoints = [
        [expandedX, expandedY],
        [expandedX + expandedWidth, expandedY],
        [expandedX + expandedWidth, expandedY + expandedHeight],
        [expandedX, expandedY + expandedHeight],
        [expandedX, expandedY]
    ];
    const pointsAttr = outlinePoints.map(p => p.join(',')).join(' ');
    const outline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    outline.setAttribute("points", pointsAttr);
    outline.setAttribute("fill", "none");
    outline.setAttribute("stroke", "#5B57D1");
    outline.setAttribute("stroke-width", 1.5);
    outline.setAttribute("stroke-dasharray", "4 2");
    outline.setAttribute("style", "pointer-events: none;");
    outline.setAttribute("class", "selection-outline");

    // Apply the same rotation as the image
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    outline.setAttribute('transform', `rotate(${imageRotation}, ${centerX}, ${centerY})`);

    svg.appendChild(outline);

    // Add resize anchors
    addResizeAnchors(expandedX, expandedY, expandedWidth, expandedHeight, centerX, centerY);
    
    // Add rotation anchor
    addRotationAnchor(expandedX, expandedY, expandedWidth, expandedHeight, centerX, centerY);
}


function removeSelectionOutline() {
    // Remove the selection outline
    const outline = svg.querySelector(".selection-outline");
    if (outline) {
        svg.removeChild(outline);
    }

    // Remove resize anchors
    removeResizeAnchors();
    
    // Remove rotation anchor
    removeRotationAnchor();

    // Remove drag event listeners
    if (selectedImage) {
        selectedImage.removeEventListener('mousedown', startDrag);
        selectedImage.removeEventListener('mouseup', stopDrag);
        selectedImage.removeEventListener('mouseleave', stopDrag);
    }
}

function addResizeAnchors(x, y, width, height, centerX, centerY) {
    const anchorSize = 10; // Size of the resize anchors
    const anchorStrokeWidth = 2;

    const positions = [
        { x: x, y: y }, // Top-left
        { x: x + width, y: y }, // Top-right
        { x: x, y: y + height }, // Bottom-left
        { x: x + width, y: y + height } // Bottom-right
    ];

    positions.forEach((pos, i) => {
        const anchor = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        anchor.setAttribute("x", pos.x - anchorSize / 2);
        anchor.setAttribute("y", pos.y - anchorSize / 2);
        anchor.setAttribute("width", anchorSize);
        anchor.setAttribute("height", anchorSize);
        anchor.setAttribute("fill", "#121212");
        anchor.setAttribute("stroke", "#5B57D1");
        anchor.setAttribute("stroke-width", anchorStrokeWidth);
        anchor.setAttribute("class", "resize-anchor");
        anchor.style.cursor = ["nw-resize", "ne-resize", "sw-resize", "se-resize"][i];

        // Apply the same rotation as the image
        anchor.setAttribute('transform', `rotate(${imageRotation}, ${centerX}, ${centerY})`);

        svg.appendChild(anchor);

        // Add event listeners for resizing
        anchor.addEventListener('mousedown', startResize);
        anchor.addEventListener('mouseup', stopResize);
    });
}

function addRotationAnchor(x, y, width, height, centerX, centerY) {
    const anchorStrokeWidth = 2;
    const rotationAnchorPos = { x: x + width / 2, y: y - 30 };
    
    const rotationAnchor = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    rotationAnchor.setAttribute('cx', rotationAnchorPos.x);
    rotationAnchor.setAttribute('cy', rotationAnchorPos.y);
    rotationAnchor.setAttribute('r', 8);
    rotationAnchor.setAttribute('class', 'rotation-anchor');
    rotationAnchor.setAttribute('fill', '#121212');
    rotationAnchor.setAttribute('stroke', '#5B57D1');
    rotationAnchor.setAttribute('stroke-width', anchorStrokeWidth);
    rotationAnchor.setAttribute('style', 'pointer-events: all;');
    
    // Apply the same rotation as the image
    rotationAnchor.setAttribute('transform', `rotate(${imageRotation}, ${centerX}, ${centerY})`);
    
    svg.appendChild(rotationAnchor);

    // Add event listeners for rotation
    rotationAnchor.addEventListener('mousedown', startRotation);
    rotationAnchor.addEventListener('mouseup', stopRotation);
    
    rotationAnchor.addEventListener('mouseover', function () {
        if (!isRotatingImage && !isDragging) {
            rotationAnchor.style.cursor = 'grab';
        }
    });
    
    rotationAnchor.addEventListener('mouseout', function () {
        if (!isRotatingImage && !isDragging) {
            rotationAnchor.style.cursor = 'default';
        }
    });
}

function removeRotationAnchor() {
    const rotationAnchor = svg.querySelector(".rotation-anchor");
    if (rotationAnchor) {
        svg.removeChild(rotationAnchor);
    }
}

function addAnchor(x, y, cursor) {
    const anchorSize = 8;
    const anchor = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    anchor.setAttribute("x", x);
    anchor.setAttribute("y", y);
    anchor.setAttribute("width", anchorSize);
    anchor.setAttribute("height", anchorSize);
    anchor.setAttribute("fill", "white");
    anchor.setAttribute("stroke", "black");
    anchor.setAttribute("stroke-width", "1");
    anchor.setAttribute("class", "resize-anchor"); // For easy removal
    anchor.style.cursor = cursor;

    svg.appendChild(anchor);

    // Add event listeners for dragging
    anchor.addEventListener('mousedown', startResize);
    anchor.addEventListener('mouseup', stopResize);

}

function removeResizeAnchors() {
    const anchors = svg.querySelectorAll(".resize-anchor");
    anchors.forEach(anchor => svg.removeChild(anchor));
}

function startResize(event) {
    event.preventDefault();
    event.stopPropagation();

    currentAnchor = event.target;
    
    // Store original values at the start of resize
    originalX = parseFloat(selectedImage.getAttribute('x'));
    originalY = parseFloat(selectedImage.getAttribute('y'));
    originalWidth = parseFloat(selectedImage.getAttribute('width'));
    originalHeight = parseFloat(selectedImage.getAttribute('height'));
    
    // Store original rotation
    const transform = selectedImage.getAttribute('transform');
    if (transform) {
        const rotateMatch = transform.match(/rotate\(([^,]+)/);
        if (rotateMatch) {
            imageRotation = parseFloat(rotateMatch[1]);
        }
    }
    
    svg.addEventListener('mousemove', resizeImage);
    document.addEventListener('mouseup', stopResize);
}

function stopResize(event) {
    stopInteracting(); // Call the combined stop function
    document.removeEventListener('mouseup', stopResize); // Remove the global mouseup listener
}


function resizeImage(event) {
    if (!selectedImage || !currentAnchor) return;

    const rect = svg.getBoundingClientRect();
    const globalX = event.clientX - rect.left;
    const globalY = event.clientY - rect.top;

    // Get the current image center for rotation calculations
    const imgX = parseFloat(selectedImage.getAttribute('x'));
    const imgY = parseFloat(selectedImage.getAttribute('y'));
    const imgWidth = parseFloat(selectedImage.getAttribute('width'));
    const imgHeight = parseFloat(selectedImage.getAttribute('height'));
    const centerX = imgX + imgWidth / 2;
    const centerY = imgY + imgHeight / 2;

    // Convert mouse position to local coordinates accounting for rotation
    let localX = globalX;
    let localY = globalY;
    
    if (imageRotation !== 0) {
        // Convert rotation to radians
        const rotationRad = (imageRotation * Math.PI) / 180;
        
        // Translate to origin (center of image)
        const translatedX = globalX - centerX;
        const translatedY = globalY - centerY;
        
        // Apply inverse rotation
        localX = translatedX * Math.cos(-rotationRad) - translatedY * Math.sin(-rotationRad) + centerX;
        localY = translatedX * Math.sin(-rotationRad) + translatedY * Math.cos(-rotationRad) + centerY;
    }

    // Calculate resize deltas in local coordinate space
    let dx = localX - originalX;
    let dy = localY - originalY;

    let newWidth = originalWidth;
    let newHeight = originalHeight;
    let newX = originalX;
    let newY = originalY;
    const aspectRatio = originalHeight / originalWidth;

    switch (currentAnchor.style.cursor) {
        case "nw-resize":
            newWidth = originalWidth - dx;
            newHeight = originalHeight - dy;
            if (aspect_ratio_lock) {
                newHeight = newWidth * aspectRatio;
                // Adjust dy to maintain aspect ratio
                dy = originalHeight - newHeight;
            }
            newX = originalX + (originalWidth - newWidth);
            newY = originalY + (originalHeight - newHeight);
            break;
        case "ne-resize":
            newWidth = dx;
            newHeight = originalHeight - dy;
            if (aspect_ratio_lock) {
                newHeight = newWidth * aspectRatio;
                // Adjust dy to maintain aspect ratio
                dy = originalHeight - newHeight;
            }
            newX = originalX;
            newY = originalY + (originalHeight - newHeight);
            break;
        case "sw-resize":
            newWidth = originalWidth - dx;
            newHeight = dy;
            if (aspect_ratio_lock) {
                newHeight = newWidth * aspectRatio;
                // Adjust dy to maintain aspect ratio
                dy = newHeight;
            }
            newX = originalX + (originalWidth - newWidth);
            newY = originalY;
            break;
        case "se-resize":
            newWidth = dx;
            newHeight = dy;
            if (aspect_ratio_lock) {
                newHeight = newWidth * aspectRatio;
            }
            newX = originalX;
            newY = originalY;
            break;
    }

    // Ensure minimum size
    newWidth = Math.max(minImageSize, newWidth);
    newHeight = Math.max(minImageSize, newHeight);

    // Apply the new dimensions and position
    selectedImage.setAttribute('width', newWidth);
    selectedImage.setAttribute('height', newHeight);
    selectedImage.setAttribute('x', newX);
    selectedImage.setAttribute('y', newY);

    // Reapply the rotation transform with the new center
    const newCenterX = newX + newWidth / 2;
    const newCenterY = newY + newHeight / 2;
    selectedImage.setAttribute('transform', `rotate(${imageRotation}, ${newCenterX}, ${newCenterY})`);

    // Update the selection outline and anchors
    removeSelectionOutline();
    addSelectionOutline();
}





function globalToLocalPoint(svg, element, x, y) {
    const ctm = element.getCTM();
    if (!ctm) return { x, y }; // fallback

    const inverseMatrix = ctm.inverse();
    const point = svg.createSVGPoint();
    point.x = x;
    point.y = y;
    const transformed = point.matrixTransform(inverseMatrix);
    return { x: transformed.x, y: transformed.y };
}


function startRotation(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!selectedImage) return;

    isRotatingImage = true;
    
    // Get image center
    const imgX = parseFloat(selectedImage.getAttribute('x'));
    const imgY = parseFloat(selectedImage.getAttribute('y'));
    const imgWidth = parseFloat(selectedImage.getAttribute('width'));
    const imgHeight = parseFloat(selectedImage.getAttribute('height'));
    
    const centerX = imgX + imgWidth / 2;
    const centerY = imgY + imgHeight / 2;

    // Calculate initial mouse angle relative to image center
    const rect = svg.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    startRotationMouseAngle = Math.atan2(mouseY - centerY, mouseX - centerX) * 180 / Math.PI;
    startImageRotation = imageRotation;

    svg.addEventListener('mousemove', rotateImage);
    document.addEventListener('mouseup', stopRotation);
    
    svg.style.cursor = 'grabbing';
}

function rotateImage(event) {
    if (!isRotatingImage || !selectedImage) return;

    // Get image center
    const imgX = parseFloat(selectedImage.getAttribute('x'));
    const imgY = parseFloat(selectedImage.getAttribute('y'));
    const imgWidth = parseFloat(selectedImage.getAttribute('width'));
    const imgHeight = parseFloat(selectedImage.getAttribute('height'));
    
    const centerX = imgX + imgWidth / 2;
    const centerY = imgY + imgHeight / 2;

    // Calculate current mouse angle
    const rect = svg.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    const currentMouseAngle = Math.atan2(mouseY - centerY, mouseX - centerX) * 180 / Math.PI;
    const angleDiff = currentMouseAngle - startRotationMouseAngle;
    
    imageRotation = startImageRotation + angleDiff;
    imageRotation = imageRotation % 360;
    if (imageRotation < 0) imageRotation += 360;

    // Apply rotation transform
    selectedImage.setAttribute('transform', `rotate(${imageRotation}, ${centerX}, ${centerY})`);

    // Update the selection outline and anchors
    removeSelectionOutline();
    addSelectionOutline();
}

function stopRotation(event) {
    
    if (!isRotatingImage) return;
    stopInteracting();
    isRotatingImage = false;
    startRotationMouseAngle = null;
    startImageRotation = null;
    svg.removeEventListener('mousemove', rotateImage);
    document.removeEventListener('mouseup', stopRotation);
    svg.style.cursor = 'default';
    
}

function startDrag(event) {
    if (!isSelectionToolActive || !selectedImage) return;

    event.preventDefault();
    event.stopPropagation();

    isDragging = true;
    
    // Store original values at the start of drag
    originalX = parseFloat(selectedImage.getAttribute('x'));
    originalY = parseFloat(selectedImage.getAttribute('y'));
    originalWidth = parseFloat(selectedImage.getAttribute('width'));
    originalHeight = parseFloat(selectedImage.getAttribute('height'));
    
    // Store original rotation
    const transform = selectedImage.getAttribute('transform');
    if (transform) {
        const rotateMatch = transform.match(/rotate\(([^,]+)/);
        if (rotateMatch) {
            imageRotation = parseFloat(rotateMatch[1]);
        }
    }

    const rect = svg.getBoundingClientRect();
    dragOffsetX = event.clientX - rect.left - parseFloat(selectedImage.getAttribute('x'));
    dragOffsetY = event.clientY - rect.top - parseFloat(selectedImage.getAttribute('y'));

    svg.addEventListener('mousemove', dragImage);
    document.addEventListener('mouseup', stopDrag);
}

function dragImage(event) {
    if (!isDragging || !selectedImage) return;

    const rect = svg.getBoundingClientRect();
    let x = event.clientX - rect.left - dragOffsetX;
    let y = event.clientY - rect.top - dragOffsetY;

    selectedImage.setAttribute('x', x);
    selectedImage.setAttribute('y', y);

    // Reapply the rotation transform with the new position
    const newCenterX = x + parseFloat(selectedImage.getAttribute('width')) / 2;
    const newCenterY = y + parseFloat(selectedImage.getAttribute('height')) / 2;
    selectedImage.setAttribute('transform', `rotate(${imageRotation}, ${newCenterX}, ${newCenterY})`);

    // // Update original values for consistent behavior
    // originalX = x;
    // originalY = y;
    // originalWidth = parseFloat(selectedImage.getAttribute('width'));
    // originalHeight = parseFloat(selectedImage.getAttribute('height'));

    // Update the selection outline and anchors
    removeSelectionOutline();
    addSelectionOutline();
}


function stopDrag(event) {
    stopInteracting(); // Call the combined stop function
    document.removeEventListener('mouseup', stopDrag); // Remove the global mouseup listener
}


function stopInteracting() {
    // Store transform data before stopping interaction
    if (selectedImage && (isDragging || isRotatingImage || currentAnchor)) {
        const newPos = {
            x: parseFloat(selectedImage.getAttribute('x')),
            y: parseFloat(selectedImage.getAttribute('y')),
            width: parseFloat(selectedImage.getAttribute('width')),
            height: parseFloat(selectedImage.getAttribute('height')),
            rotation: imageRotation
        };
        
        // Get the original rotation from the stored start rotation or current rotation
        let originalRotation = imageRotation;
        if (isRotatingImage && startImageRotation !== null) {
            originalRotation = startImageRotation;
        }
        
        const oldPos = {
            x: originalX,
            y: originalY,
            width: originalWidth,
            height: originalHeight,
            rotation: originalRotation
        };
        console.log(oldPos, newPos);
        console.log(oldPos.x, newPos.x)
        // Only push transform action if something actually changed
        if (newPos.x !== oldPos.x || newPos.y !== oldPos.y || 
            newPos.width !== oldPos.width || newPos.height !== oldPos.height ||
            newPos.rotation !== oldPos.rotation) {
            
            pushTransformAction({
                type: 'image',
                element: selectedImage,
                restore: (pos) => {
                    selectedImage.setAttribute('x', pos.x);
                    selectedImage.setAttribute('y', pos.y);
                    selectedImage.setAttribute('width', pos.width);
                    selectedImage.setAttribute('height', pos.height);
                    const centerX = pos.x + pos.width / 2;
                    const centerY = pos.y + pos.height / 2;
                    selectedImage.setAttribute('transform', `rotate(${pos.rotation}, ${centerX}, ${centerY})`);
                    imageRotation = pos.rotation;
                    
                    // Update selection outline if image is selected
                    if (selectedImage) {
                        removeSelectionOutline();
                        addSelectionOutline();
                    }
                    console.log("Pushed the transform")
                }
            }, oldPos, newPos);
            
        }
    }

    isDragging = false;
    isRotatingImage = false;
    svg.removeEventListener('mousemove', dragImage);
    svg.removeEventListener('mousemove', resizeImage);
    svg.removeEventListener('mousemove', rotateImage);
    currentAnchor = null;
    startRotationMouseAngle = null;
    startImageRotation = null;

    // Update originalX, originalY, originalWidth and originalHeight after dragging/resizing is complete
    if (selectedImage) {
        originalX = parseFloat(selectedImage.getAttribute('x'));
        originalY = parseFloat(selectedImage.getAttribute('y'));
        originalWidth = parseFloat(selectedImage.getAttribute('width'));
        originalHeight = parseFloat(selectedImage.getAttribute('height'));
        
        // Update the current rotation from the image transform
        const transform = selectedImage.getAttribute('transform');
        if (transform) {
            const rotateMatch = transform.match(/rotate\(([^,]+)/);
            if (rotateMatch) {
                imageRotation = parseFloat(rotateMatch[1]);
            }
        }
    }
}


export { handleMouseDownImage, handleMouseMoveImage, handleMouseUpImage };