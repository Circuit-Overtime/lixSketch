let isDraggingImage = false;
let imageToPlace = null;
let imageX = 0;
let imageY = 0;
// const selectedTool = document.querySelector(".bx-image-alt");
let scaleFactor = 0.2; // Adjust this to control initial miniature size
let currentImageElement = null; // Keep track of the miniature image element
// Assumes isImageToolActive, svg, selectedTool, etc., are already defined in the scope.

document.getElementById("importImage").addEventListener('click', () => {
    isImageToolActive = true; // Assuming isImageToolActive is defined elsewhere
    // Create a dummy file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';  // Allow all image types
    fileInput.style.display = 'none'; // Hide the input element

    // Add an event listener to the file input
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        handleImageUpload(file);

        // Remove the file input after use
        document.body.removeChild(fileInput);
    });

    // Append the file input to the body and trigger the click
    document.body.appendChild(fileInput); //  Important:  Append to body (or another valid container)
    fileInput.click();
});

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

        const action = {
            type: ACTION_CREATE,
            element: finalImage,
            parent: finalImage.parentNode,
            nextSibling: finalImage.nextSibling,
            data: {
                href: imageToPlace,
                x: placedX - placedImageWidth / 2,
                y: placedY - placedImageHeight / 2,
                width: placedImageWidth,
                height: placedImageHeight
            }
        };
        history.push(action);
        updateUndoRedoButtons();

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