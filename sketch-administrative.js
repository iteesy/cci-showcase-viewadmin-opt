let capture;
// Hybrid system: BodyPose for body + FaceMesh for face
let bodyPose;
let faceMesh;
let poses = [];
let faces = [];

// Form field images
let fieldImages = {};

// Layer cycling animation variables
let fieldCycleTimer = 0;
let fieldCycleSpeed = 500; 
let currentTopFieldIndex = 0;
let allFaceFieldsFlat = []; // Will be populated in setup()

// FACE MESH FIELDS - Using facial landmarks for precise positioning
let faceLayeredFields = {
    identity: {
        // Core identity spread across forehead and key face areas
        "forehead_center": "identity_ssn_med.png",      // Landmark ~10 (forehead center)
        "forehead_left": "identity_anum_med.png",       // Landmark ~67 (left forehead)
        "forehead_right": "identity_gender_med.png",    // Landmark ~297 (right forehead)
        "temple_left": "identity_dob_small.png",        // Landmark ~21 (left temple)
        "temple_right": "identity_uscis_status_small.png", // Landmark ~251 (right temple)
        "eyebrow_center": "identity_ctry_citizenship_small.png" // Landmark ~9 (between eyebrows)
    },
    physical: {
        "cheek_left": "physical_eye_small.png",         // Landmark ~116 (left cheek)
        "cheek_right": "physical_hair_small.png",       // Landmark ~345 (right cheek)
        "jaw_left": "physical_weight_small.png",        // Landmark ~172 (left jaw)
        "jaw_right": "physical_height_small.png",       // Landmark ~397 (right jaw)
        "chin": null // Available slot
    },
    demographics: {
        "nose_tip": "demographics_marital_status_med.png", // Landmark ~1 (nose tip)
        "mouth_left": "demographics_ethnicity_radio.png",   // Landmark ~61 (mouth left)
        "mouth_right": "demographics_race_checkbox.png",    // Landmark ~291 (mouth right)
        "lip_bottom": "demographics_income_radio.png"       // Landmark ~18 (bottom lip)
    }
};

// FaceMesh landmark mapping for positioning
let faceLandmarkMap = {
    "forehead_center": 10,
    "forehead_left": 67,
    "forehead_right": 297,
    "temple_left": 21,
    "temple_right": 251,
    "cheek_left": 116,
    "cheek_right": 345,
    "jaw_left": 172,
    "jaw_right": 397,
    "nose_tip": 1,
    "eyebrow_center": 9,  // Between eyebrows landmark
    "mouth_left": 61,
    "mouth_right": 291,
    "lip_bottom": 18
};

let allBodyFieldsFlat = []; // Array of all body field filenames for random cycling
let bodyFieldCycleTimer = 0;
let bodyFieldCycleSpeed = 1000; // Could be different from face fields
let currentTopBodyFieldIndex = 0;

// FIXED KEYPOINT FIELDS (Non-face areas)
let keypointImageMap = {
    // Upper body - Family clusters
    "left_shoulder": "family_father_med.png",
    "right_shoulder": "family_mother_med.png",
    "left_elbow": "family_spouse_med.png",
    "right_elbow": "family_spouse_birthplace_med.png",
    "left_wrist": "family_children_name_med.png",
    // Also need to add birthplace back to the mix
    "right_wrist": "identity_birthplace_med.png",
    
    // Core/Hip area - Work & Contact
    "left_hip": "work_occupation_med.png",
    "right_hip": "work_employer_med.png",
    
    // Lower body - Contact & Travel  
    "left_knee": "contact_address_med.png",
    "right_knee": "contact_phone_med.png",
    "left_ankle": "travel_doc_med.png",
    "right_ankle": "travel_visa_med.png"
};

// ALL BODY FIELDS NOW BOUNCING - DVD Screensaver style within body area  
let bouncingFieldImages = [
    // Original body keypoint fields (now bouncing instead of fixed)
    "family_father_med.png",           // Was left_shoulder
    "family_mother_med.png",           // Was right_shoulder  
    "family_spouse_med.png",           // Was left_elbow
    "family_spouse_birthplace_med.png", // Was right_elbow
    "family_children_name_med.png",    // Was left_wrist
    "identity_birthplace_med.png",     // Was right_wrist
    "work_occupation_med.png",         // Was left_hip
    "work_employer_med.png",           // Was right_hip
    "contact_address_med.png",         // Was left_knee
    "contact_phone_med.png",           // Was right_knee
    "travel_doc_med.png",              // Was left_ankle
    "travel_visa_med.png",             // Was right_ankle
    
    // Additional bouncing fields
    "family_children_dob_med.png",
    "family_spouse_citizenship_med.png",
    "family_spouse_cntry_citizenship_med.png", 
    "family_spouse_employer_med.png",
    "family_spouse_job_med.png",
    "family_spouse_marriage_med.png",
    "family_spouse_status_med.png",
    "family_children_address_med.png",
    "family_children_amt_small.png",
    "family_children_birthplace_med.png",
    "family_children_citizenship_med.png",
    "family_children_cntry_citizenship_med.png",
    "legal_employer_med.png",          // Kept the main legal employer file
    "travel_cntry_med.png",
    "travel_instates_med.png",
    "identity_anum_med.png",
    "questions_1_radio.png",
    "questions_2_radio.png",
    "questions_3_radio.png",
    "questions_4_radio.png",
    "questions_5_radio.png",
    "questions_6_radio.png",
    "questions_7_radio.png",
    "questions_8_radio.png",
    "questions_9_radio.png",
    "questions_10_radio.png",
    "questions_11_radio.png",
    "questions_12_radio.png",
    "questions_13_radio.png",
    "questions_14_radio.png",
    "questions_15_radio.png",
    "questions_16_radio.png",
    "questions_17_radio.png"
];

// Simple bouncing fields - back to original working system

// Bouncing field objects
let bouncingFields = [];

// Gallery variables
let galleryPhotos = [];
let maxGalleryPhotos = 20;
let galleryUpdateInterval = 2000;
let showSkeleton = false;

// URL parameter detection for view mode
const urlParams = new URLSearchParams(window.location.search);
const viewMode = urlParams.get('view') || 'administrative'; // Default to administrative

function preload() {
    // Load BodyPose and FaceMesh for administrative view
    bodyPose = ml5.bodyPose('MoveNet', {
        modelType: 'SINGLEPOSE_LIGHTNING'
    });
    
    faceMesh = ml5.faceMesh({
        maxFaces: 1,
        refineLandmarks: false,
        flipHorizontal: false
    });

    // Load all form field images
    loadFormFieldImages();
}

function loadFormFieldImages() {
    // Load face layered fields
    for (let layer in faceLayeredFields) {
        for (let keypoint in faceLayeredFields[layer]) {
            let filename = faceLayeredFields[layer][keypoint];
            if (filename && !fieldImages[filename]) {
                fieldImages[filename] = loadImage(`photos/form_fields/${filename}`);
            }
        }
    }
    
    // Load fixed keypoint fields
    for (let keypoint in keypointImageMap) {
        let filename = keypointImageMap[keypoint];
        if (filename && !fieldImages[filename]) {
            fieldImages[filename] = loadImage(`photos/form_fields/${filename}`);
        }
    }
    
    // Load bouncing field images
    for (let filename of bouncingFieldImages) {
        if (!fieldImages[filename]) {
            fieldImages[filename] = loadImage(`photos/form_fields/${filename}`);
        }
    }
    
    console.log(`Loading ${Object.keys(fieldImages).length} form field images...`);
}

function setup() {
    // Full screen canvas
    createCanvas(windowWidth, windowHeight);
    
    // Initialize webcam
    capture = createCapture(VIDEO);
    capture.size(640, 480);
    capture.hide();
    
    // Start detection systems
    bodyPose.detectStart(capture, gotPoses);
    faceMesh.detectStart(capture, gotFaces);
    
    // Initialize bouncing fields
    initializeBouncingFields();
    
    // Initialize field cycling for both face and body
    initializeFieldCycling();
    initializeBodyFieldCycling();
    
    // Initialize gallery wall if in gallery mode
    if (viewMode === 'gallery') {
        loadGalleryPhotos();
        setInterval(loadGalleryPhotos, galleryUpdateInterval);
    }
}

// Create flat array of all individual face fields
function initializeFieldCycling() {
    allFaceFieldsFlat = [];
    
    // Flatten all face fields into a single array for cycling
    for (let layerName in faceLayeredFields) {
        for (let landmarkName in faceLayeredFields[layerName]) {
            let filename = faceLayeredFields[layerName][landmarkName];
            if (filename && fieldImages[filename]) { // Only add if file exists
                allFaceFieldsFlat.push({
                    layer: layerName,
                    landmark: landmarkName,
                    filename: filename,
                    displayName: filename.replace('.png', '').replace('_', ' ')
                });
            }
        }
    }
    
    console.log(`Initialized field cycling with ${allFaceFieldsFlat.length} individual fields`);
}

function initializeBodyFieldCycling() {
    allBodyFieldsFlat = [...bouncingFieldImages]; // Copy all bouncing field filenames
    console.log(`Initialized body field cycling with ${allBodyFieldsFlat.length} fields`);
}

function initializeBouncingFields() {
    bouncingFields = [];
    
    // Create bouncing field objects with ORGANIC pre-distribution
    for (let i = 0; i < bouncingFieldImages.length; i++) {
        let filename = bouncingFieldImages[i];
        bouncingFields.push({
            filename: filename,
            // 🌱 ORGANIC APPROACH: Pre-distribute in expected body area (center 60% of screen)
            x: random(windowWidth * 0.2, windowWidth * 0.8),    // Expected body width
            y: random(windowHeight * 0.15, windowHeight * 0.85), // Expected body height (head to legs)
            vx: random(-2, 2),
            vy: random(-2, 2),
            minSpeed: 0.5,
            maxSpeed: 2
        });
    }
    
    console.log(`Initialized ${bouncingFields.length} bouncing fields in organic distribution`);
}



function gotPoses(results) {
    poses = results;
}

function gotFaces(results) {
    faces = results;
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

function draw() {
    background(240, 240, 250);
    
    if (viewMode === 'gallery') {
        drawGalleryWall();
    } else {
        // Default to administrative view
        drawAdministrativeSide();
    }
}

function drawAdministrativeSide() {
    // Draw webcam feed
    if (capture.loadedmetadata) {
        image(capture, 0, 0, windowWidth, windowHeight);
        
        // Apply visual effects
        filter(BLUR, 8);
        
        noTint();
    }
    
    // Draw bouncing body fields
    drawBouncingFields();
    
    // Draw layered face fields (FaceMesh - static positioning)
    drawFaceMeshLayeredFields();
    
    // Optional: Draw skeleton for debugging
    if (showSkeleton) {
        drawSkeleton();
    }
}

function drawBouncingFields() {
    if (poses.length === 0) return;

    // RANDOM BODY FIELD CYCLING LOGIC
    if (millis() - bodyFieldCycleTimer > bodyFieldCycleSpeed) {
        currentTopBodyFieldIndex = Math.floor(random(allBodyFieldsFlat.length));
        bodyFieldCycleTimer = millis();
        console.log(`Body field cycle: ${allBodyFieldsFlat[currentTopBodyFieldIndex]} now on top`);
    }

    let topBodyField = allBodyFieldsFlat[currentTopBodyFieldIndex];
    
    let pose = poses[0];
    
    // Get body bounds for constraining bouncing fields
    let bodyBounds = getBodyBounds(pose);
    if (!bodyBounds) return;
    
    // FIRST PASS: Draw all fields EXCEPT the top one, and update positions
    for (let field of bouncingFields) {
        // Update position - simple bouncing movement
        field.x += field.vx;
        field.y += field.vy;
        
        let fieldImg = fieldImages[field.filename];
        if (!fieldImg) continue;
        
        // 🚨🚨🚨 TEMPORARY SCALING FOR DEVELOPMENT - REMOVE FOR 40" MONITOR! 🚨🚨🚨
        let devScale = 0.6;
        let scaledWidth = fieldImg.width * devScale;
        let scaledHeight = fieldImg.height * devScale;
        // 🚨🚨🚨 REMOVE THIS SCALING WHEN INSTALLING ON LARGE DISPLAY! 🚨🚨🚨
        
        // Bounce off body boundaries (DVD screensaver style)
        if (field.x <= bodyBounds.minX || field.x + scaledWidth >= bodyBounds.maxX) {
            field.vx *= -1;
            field.x = constrain(field.x, bodyBounds.minX, bodyBounds.maxX - scaledWidth);
        }
        if (field.y <= bodyBounds.minY || field.y + scaledHeight >= bodyBounds.maxY) {
            field.vy *= -1;
            field.y = constrain(field.y, bodyBounds.minY, bodyBounds.maxY - scaledHeight);
        }
        
        // Ensure minimum speed (prevent getting stuck)
        if (abs(field.vx) < field.minSpeed) field.vx = field.vx > 0 ? field.minSpeed : -field.minSpeed;
        if (abs(field.vy) < field.minSpeed) field.vy = field.vy > 0 ? field.minSpeed : -field.minSpeed;
        
        // Cap maximum speed
        field.vx = constrain(field.vx, -field.maxSpeed, field.maxSpeed);
        field.vy = constrain(field.vy, -field.maxSpeed, field.maxSpeed);
        
        // Draw the field ONLY if it's not the top field
        if (field.filename !== topBodyField) {
            image(fieldImg, field.x, field.y, scaledWidth, scaledHeight);
        }
    }
    
        // SECOND PASS: Draw the top field last (so it appears on top)
    for (let field of bouncingFields) {
        if (field.filename === topBodyField) {
            let fieldImg = fieldImages[field.filename];
            if (fieldImg) {
                // Make the top field slightly larger for emphasis
                let devScale = 0.6;
                let topScale = devScale * 1.1; // 10% larger
                let topWidth = fieldImg.width * topScale;
                let topHeight = fieldImg.height * topScale;
                image(fieldImg, field.x, field.y, topWidth, topHeight);
            }
            break; // Only draw the first match
        }
    }
}

function getBodyBounds(pose) {
    let validKeypoints = pose.keypoints.filter(kp => kp.confidence > 0.3);
    if (validKeypoints.length === 0) return null;
    
    // Scale keypoints to canvas size and find bounds
    let scaledKeypoints = validKeypoints.map(kp => ({
        x: map(kp.x, 0, capture.width, 0, windowWidth),
        y: map(kp.y, 0, capture.height, 0, windowHeight)
    }));
    
    let minX = Math.min(...scaledKeypoints.map(kp => kp.x)) - 50; // Add padding
    let maxX = Math.max(...scaledKeypoints.map(kp => kp.x)) + 50;
    let minY = Math.min(...scaledKeypoints.map(kp => kp.y)) - 50;
    let maxY = Math.max(...scaledKeypoints.map(kp => kp.y)) + 50;
    
    // Ensure bounds stay within canvas
    return {
        minX: Math.max(0, minX),
        maxX: Math.min(windowWidth, maxX),
        minY: Math.max(0, minY),
        maxY: Math.min(windowHeight, maxY)
    };
}

function drawFaceMeshLayeredFields() {
    if (faces.length === 0 || allFaceFieldsFlat.length === 0) return;
    
    let face = faces[0]; // Use first detected face
    
    // INDIVIDUAL FIELD CYCLING LOGIC - which specific field should be drawn on top
    if (millis() - fieldCycleTimer > fieldCycleSpeed) {
        currentTopFieldIndex = (currentTopFieldIndex + 1) % allFaceFieldsFlat.length;
        fieldCycleTimer = millis();
        let currentField = allFaceFieldsFlat[currentTopFieldIndex];
        console.log(`Field cycle: ${currentField.displayName} now on top`);
    }
    
    // Get the current top field
    let topField = allFaceFieldsFlat[currentTopFieldIndex];
    
    // Draw ALL fields first (in normal order)
    let layers = ['demographics', 'physical', 'identity'];
    
    for (let layer of layers) {
        // Define drawing order within each layer
        let drawingOrder;
        if (layer === 'identity') {
            drawingOrder = ['temple_left', 'eyebrow_center', 'forehead_left', 'forehead_right', 'temple_right', 'forehead_center'];
        } else if (layer === 'demographics') {
            drawingOrder = ['mouth_left', 'mouth_right', 'lip_bottom', 'nose_tip'];
        } else {
            drawingOrder = Object.keys(faceLayeredFields[layer]);
        }
        
        for (let landmarkName of drawingOrder) {
            let imageFilename = faceLayeredFields[layer][landmarkName];
            if (imageFilename && fieldImages[imageFilename]) {
                
                // Skip drawing the top field here - we'll draw it last
                if (layer === topField.layer && landmarkName === topField.landmark) {
                    continue; // Skip this field, draw it on top later
                }
                
                drawSingleFaceField(face, layer, landmarkName, imageFilename, false);
            }
        }
    }
    
    // NOW draw the top field last (so it appears on top)
    drawSingleFaceField(face, topField.layer, topField.landmark, topField.filename, true);
}

// Helper function to draw a single face field
function drawSingleFaceField(face, layer, landmarkName, imageFilename, isTopField) {
    let landmarkIndex = faceLandmarkMap[landmarkName];
    if (landmarkIndex === undefined || !face.keypoints[landmarkIndex]) return;
    
    let landmark = face.keypoints[landmarkIndex];
    
    // Direct coordinate scaling
    let x = landmark.x * (windowWidth / capture.width);
    let y = landmark.y * (windowHeight / capture.height);
    
    // Layer offset for visibility
    let layerOffsetX = layer === 'physical' ? 10 : (layer === 'demographics' ? 20 : 0);
    let layerOffsetY = layer === 'physical' ? 5 : (layer === 'demographics' ? 10 : 0);
    
    // Apply offset positioning
    let offsetX = x + layerOffsetX;
    let offsetY = y + layerOffsetY;
    
    // SPECIAL CASE: Move SSN to top of head (above forehead)
    if (imageFilename === "identity_ssn_med.png") {
        offsetY = offsetY - 80;
    }
    
    // Get field image dimensions with scaling
    let fieldImg = fieldImages[imageFilename];
    
    // 🚨🚨🚨 TEMPORARY SCALING FOR DEVELOPMENT - REMOVE FOR 40" MONITOR! 🚨🚨🚨
    let devScale = 0.6;
    let scaledWidth = fieldImg.width * devScale;
    let scaledHeight = fieldImg.height * devScale;
    
    // Optional: Make the top field slightly larger or add a subtle effect
    if (isTopField) {
        scaledWidth *= 1.05;
        scaledHeight *= 1.05;
    }
    // 🚨🚨🚨 REMOVE THIS SCALING WHEN INSTALLING ON LARGE DISPLAY! 🚨🚨🚨
    
    // Center the field on the landmark
    offsetX = offsetX - (scaledWidth / 2) + layerOffsetX;
    offsetY = offsetY - (scaledHeight / 2) + layerOffsetY;
    
    // Ensure fields stay within canvas bounds
    offsetX = constrain(offsetX, 0, windowWidth - scaledWidth);
    offsetY = constrain(offsetY, 0, windowHeight - scaledHeight);
    
    // Draw the form field image
    image(fieldImg, offsetX, offsetY, scaledWidth, scaledHeight);
}

function drawSkeleton() {
    if (poses.length === 0) return;
    
    let pose = poses[0];
    
    // Define skeleton connections
    let connections = [
        ['left_shoulder', 'right_shoulder'],
        ['left_shoulder', 'left_elbow'],
        ['left_elbow', 'left_wrist'],
        ['right_shoulder', 'right_elbow'],
        ['right_elbow', 'right_wrist'],
        ['left_shoulder', 'left_hip'],
        ['right_shoulder', 'right_hip'],
        ['left_hip', 'right_hip'],
        ['left_hip', 'left_knee'],
        ['left_knee', 'left_ankle'],
        ['right_hip', 'right_knee'],
        ['right_knee', 'right_ankle']
    ];
    
    stroke(255, 100, 100, 150);
    strokeWeight(3);
    
    for (let connection of connections) {
        let keypointA = pose.keypoints.find(kp => kp.name === connection[0]);
        let keypointB = pose.keypoints.find(kp => kp.name === connection[1]);
        
        if (keypointA && keypointB && keypointA.confidence > 0.3 && keypointB.confidence > 0.3) {
            let x1 = map(keypointA.x, 0, capture.width, 0, windowWidth);
            let y1 = map(keypointA.y, 0, capture.height, 0, windowHeight);
            let x2 = map(keypointB.x, 0, capture.width, 0, windowWidth);
            let y2 = map(keypointB.y, 0, capture.height, 0, windowHeight);
            
            line(x1, y1, x2, y2);
        }
    }
}

function drawGalleryWall() {
    // Dark background
    background(20, 20, 30);
    
    if (galleryPhotos.length === 0) {
        // Show placeholder text
        fill(255, 255, 255, 100);
        textAlign(CENTER, CENTER);
        textSize(15);
        text("Gallery Wall\nPhotos will appear here as they're captured", 
             windowWidth/2, windowHeight/2);
        return;
    }
    
    // Calculate grid layout
    let cols = Math.ceil(Math.sqrt(galleryPhotos.length));
    let rows = Math.ceil(galleryPhotos.length / cols);
    
    // Calculate photo dimensions with padding
    let padding = 20;
    let availableWidth = windowWidth - (padding * (cols + 1));
    let availableHeight = windowHeight - (padding * (rows + 1));
    let photoWidth = availableWidth / cols;
    let photoHeight = availableHeight / rows;
    
    // Keep aspect ratio by using the smaller dimension
    let photoSize = Math.min(photoWidth, photoHeight);
    
    // Center the grid
    let startX = (windowWidth - (cols * photoSize + (cols - 1) * padding)) / 2;
    let startY = (windowHeight - (rows * photoSize + (rows - 1) * padding)) / 2;
    
    // Draw photos in grid
    for (let i = 0; i < galleryPhotos.length; i++) {
        let col = i % cols;
        let row = Math.floor(i / cols);
        
        let x = startX + col * (photoSize + padding);
        let y = startY + row * (photoSize + padding);
        
        // Draw photo exactly as captured
        let photo = galleryPhotos[i];
        if (photo.img) {
            image(photo.img, x, y, photoSize, photoSize);
        }
        
        // Optional: Add a subtle border
        noFill();
        stroke(255, 255, 255, 50);
        strokeWeight(1);
        rect(x, y, photoSize, photoSize);
    }
}

function capturePhoto() {
    // Only capture if we're not in gallery mode
    if (viewMode === 'gallery') {
        console.log('Photo capture not available in gallery view');
        return;
    }
    
    // Capture the entire current canvas
    let photoData = canvas.toDataURL('image/jpeg', 0.8);
    
    // Create photo object with metadata
    let photoObj = {
        data: photoData,
        timestamp: Date.now(),
        id: 'photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    };
    
    // Save to localStorage
    savePhotoToStorage(photoObj);
    
    console.log('Photo captured and saved to gallery');
}

function savePhotoToStorage(photoObj) {
    // Get existing photos from localStorage
    let existingPhotos = JSON.parse(localStorage.getItem('galleryPhotos') || '[]');
    
    // Add new photo
    existingPhotos.push(photoObj);
    
    // Keep only the most recent photos to prevent memory issues
    if (existingPhotos.length > maxGalleryPhotos) {
        existingPhotos = existingPhotos.slice(-maxGalleryPhotos);
    }
    
    // Save back to localStorage
    localStorage.setItem('galleryPhotos', JSON.stringify(existingPhotos));
}

function loadGalleryPhotos() {
    // Get photos from localStorage
    let storedPhotos = JSON.parse(localStorage.getItem('galleryPhotos') || '[]');
    
    // Convert base64 strings back to images
    galleryPhotos = [];
    for (let photoData of storedPhotos) {
        let img = createImg(photoData.data);
        img.hide(); // Don't show in DOM
        
        galleryPhotos.push({
            img: img,
            timestamp: photoData.timestamp,
            id: photoData.id
        });
    }
    
    // Sort by timestamp (newest first)
    galleryPhotos.sort((a, b) => b.timestamp - a.timestamp);
}

function clearGallery() {
    // Clear localStorage
    localStorage.removeItem('galleryPhotos');
    galleryPhotos = [];
    console.log('Gallery cleared');
}

function cleanup() {
    console.log('Running cleanup...');
    
    // Clean up gallery photos (keep only recent ones)
    if (galleryPhotos.length > maxGalleryPhotos) {
        // Remove oldest photos, keep newest
        let photosToRemove = galleryPhotos.splice(0, galleryPhotos.length - maxGalleryPhotos);
        console.log(`Cleaned up ${photosToRemove.length} old gallery photos`);
    }
    
    // Clean up localStorage if it's getting too big
    try {
        let storedPhotos = JSON.parse(localStorage.getItem('galleryPhotos') || '[]');
        if (storedPhotos.length > maxGalleryPhotos) {
            storedPhotos = storedPhotos.slice(-maxGalleryPhotos);
            localStorage.setItem('galleryPhotos', JSON.stringify(storedPhotos));
            console.log('Cleaned up localStorage');
        }
    } catch (e) {
        console.log('Error cleaning localStorage:', e);
    }
    
    // Force garbage collection hint (doesn't guarantee it, but suggests it)
    if (window.gc) {
        window.gc();
    }
}

function keyPressed() {
    if (key === ' ') {
        console.log('Photo captured');
        capturePhoto();
    }
    if (key === 'c' || key === 'C') {
        clearGallery();
    }
    if (key === 's' || key === 'S') {
        // Toggle skeleton drawing for debugging
        showSkeleton = !showSkeleton;
        console.log('Skeleton view:', showSkeleton ? 'ON' : 'OFF');
    }
}