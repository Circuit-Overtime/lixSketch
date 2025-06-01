let isDraggingImage = false;
let imageToPlace = null;
let imageX = 0;
let imageY = 0;
// const selectedTool = document.querySelector(".bx-image-alt");
let scaleFactor = 0.2; // Adjust this to control initial miniature size
let currentImageElement = null; // Keep track of the miniature image element
// Assumes isImageToolActive, svg, selectedTool, etc., are already defined in the scope.

// Selection functionality
let selectedImage = null;

let originalX, originalY, originalWidth, originalHeight;
let currentAnchor = null; // Keep track of which anchor is being dragged

// Dragging variables
let isDragging = false;
let dragOffsetX, dragOffsetY;

// Minimum image size
const MIN_IMAGE_SIZE = 20; // Adjust as needed


document.getElementById("importImage").addEventListener('click', () => {
    isImageToolActive = true; // Assuming isImageToolActive is defined elsewhere

    // Use a hardcoded image instead of file input
    const hardcodedImagePath = './test.jpg'; // Adjust the path if necessary
    loadHardcodedImage(hardcodedImagePath);
});

const loadHardcodedImage = (imagePath) => {
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        imageToPlace = canvas.toDataURL(); // Convert the image to a data URL
        isDraggingImage = true;
    };
    img.onerror = () => {
        console.error('Failed to load the hardcoded image.');
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


// Event listener for mousemove on the SVG
svg.addEventListener('mousemove', (e) => {
    if (!isDraggingImage || !imageToPlace || !isImageToolActive) return; // Also check isImageToolActive

    // Get mouse coordinates relative to the SVG element
    const rect = svg.getBoundingClientRect();
    imageX = e.clientX - rect.left;
    imageY = e.clientY - rect.top;

    drawMiniatureImage();
});

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
            currentImageElement.setAttribute("x", imageX - miniatureWidth / 2); // Center the image
            currentImageElement.setAttribute("y", imageY - miniatureHeight / 2);
            currentImageElement.setAttribute("width", miniatureWidth);
            currentImageElement.setAttribute("height", miniatureHeight);
            currentImageElement.setAttribute("preserveAspectRatio", "xMidYMid meet"); // Maintain aspect ratio without distortion

            svg.appendChild(currentImageElement);
        })
        .catch(error => {
            console.error("Error getting aspect ratio:", error);
            // Handle the error (e.g., display an error message)
        });
};

// Helper function to get image aspect ratio (height/width) from data URL.
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


// Event listener for click on the SVG to place the image
svg.addEventListener('click', async (e) => {
    if (!isDraggingImage || !imageToPlace || !isImageToolActive) return; // Also check isImageToolActive

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
        finalImage.setAttribute("x", placedX - placedImageWidth / 2);  // Center the final image
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
});


// Selection and manipulation logic starts here
function selectImage(event) {
    if (!isSelectionToolActive) return;

    event.stopPropagation(); // Prevent click from propagating to the SVG

    if (selectedImage) {
        removeSelectionOutline();
    }

    selectedImage = event.target;
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

    svg.appendChild(outline);

    // Add resize anchors
    addResizeAnchors(expandedX, expandedY, expandedWidth, expandedHeight);
}

function removeSelectionOutline() {
    // Remove the selection outline
    const outline = svg.querySelector(".selection-outline");
    if (outline) {
        svg.removeChild(outline);
    }

    // Remove resize anchors
    removeResizeAnchors();

      // Remove drag event listeners
    if (selectedImage) {
        selectedImage.removeEventListener('mousedown', startDrag);
        selectedImage.removeEventListener('mouseup', stopDrag);
        selectedImage.removeEventListener('mouseleave', stopDrag);
    }
}

function addResizeAnchors(x, y, width, height) {
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

        svg.appendChild(anchor);

        // Add event listeners for resizing
        anchor.addEventListener('mousedown', startResize);
        anchor.addEventListener('mouseup', stopResize);
    });
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
    event.stopPropagation(); // Prevent dragging the image itself

    currentAnchor = event.target;
    svg.addEventListener('mousemove', resizeImage); // Start resizing
    document.addEventListener('mouseup', stopResize); // Listen for mouseup on the entire document
}


function stopResize(event) {
    stopInteracting(); // Call the combined stop function
    document.removeEventListener('mouseup', stopResize); // Remove the global mouseup listener
}

function resizeImage(event) {
    if (!selectedImage || !currentAnchor) return;

    const rect = svg.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    let newWidth = originalWidth;
    let newHeight = originalHeight;

    const anchorSize = 8;

    // Determine which anchor is being dragged and resize accordingly
    switch (currentAnchor.style.cursor) {
        case "nw-resize":
            newWidth = originalWidth - (mouseX - originalX); //resize without moving x,y
            newHeight = originalHeight - (mouseY - originalY);
            break;
        case "ne-resize":
            newWidth = mouseX - originalX;
            newHeight = originalHeight - (mouseY - originalY);
            break;
        case "sw-resize":
            newWidth = originalWidth - (mouseX - originalX);
            newHeight = mouseY - originalY;
            break;
        case "se-resize":
            newWidth = mouseX - originalX;
            newHeight = mouseY - originalY;
            break;
    }

    // Keep width and height within bounds
    newWidth = Math.max(MIN_IMAGE_SIZE, newWidth);
    newHeight = Math.max(MIN_IMAGE_SIZE, newHeight);

    selectedImage.setAttribute('width', newWidth);
    selectedImage.setAttribute('height', newHeight);

    // Update the selection outline and anchors
    removeSelectionOutline();
    addSelectionOutline();
}

function startDrag(event) {
    if (!isSelectionToolActive || !selectedImage) return;

    event.preventDefault();
    event.stopPropagation();

    isDragging = true;

    const rect = svg.getBoundingClientRect();
    dragOffsetX = event.clientX - rect.left - parseFloat(selectedImage.getAttribute('x'));
    dragOffsetY = event.clientY - rect.top - parseFloat(selectedImage.getAttribute('y'));

    svg.addEventListener('mousemove', dragImage); // Drag the image itself
    document.addEventListener('mouseup', stopDrag); // Listen for mouseup on the entire document
}
function dragImage(event) {
    if (!isDragging || !selectedImage) return;

    const rect = svg.getBoundingClientRect();
    let x = event.clientX - rect.left - dragOffsetX;
    let y = event.clientY - rect.top - dragOffsetY;

    selectedImage.setAttribute('x', x);
    selectedImage.setAttribute('y', y);

    // Update the selection outline and anchors
    removeSelectionOutline();
    addSelectionOutline();
}

function stopDrag(event) {
    stopInteracting(); // Call the combined stop function
    document.removeEventListener('mouseup', stopDrag); // Remove the global mouseup listener
}

function stopInteracting() {
    isDragging = false;
    svg.removeEventListener('mousemove', dragImage);
    svg.removeEventListener('mousemove', resizeImage);  // Remove resize listener as well
    currentAnchor = null;

    // Update originalX, originalY, originalWidth and originalHeight after dragging/resizing is complete
    if (selectedImage) {
        originalX = parseFloat(selectedImage.getAttribute('x'));
        originalY = parseFloat(selectedImage.getAttribute('y'));
        originalWidth = parseFloat(selectedImage.getAttribute('width'));
        originalHeight = parseFloat(selectedImage.getAttribute('height'));
    }
}



svg.addEventListener('click', (e) => {
    if (isSelectionToolActive) {
        // If selection tool is active, this click means we want to de-select the image.
        if (selectedImage) {
            removeSelectionOutline();
            selectedImage = null;
        }
    }
});