let isIdleState = true;
let lastPersonDetectedTime = 0;
let idleTimeout = 3000; // 3 seconds with no person detected = idle state
let currentQueueNumber = 301;
let lastQueueUpdate = 0;
let crosshairImg;
let crosshairPulse = 0;
let blinkTimer = 0;

let capture;
// Hybrid system: BodyPose for body + FaceMesh for face
let bodyPose;
let faceMesh;
let poses = [];
let faces = [];

// PERFORMANCE TRACKING VARIABLES
let lastBodyDetection = 0;
let lastFaceDetection = 0;

// Form field images
let fieldImages = {};

// Cycling animation
let fieldCycleTimer = 0;
let fieldCycleSpeed = 800; // REDUCED from 500 for performance
let currentTopFieldIndex = 0;

//FACE FIELDS ONLY
let allFaceFieldsFlat = []; 

// FACE MESH FIELDS - Using facial landmarks for precise positioning
let faceLayeredFields = {
    identity: {
        "forehead_center": "identity_ssn_med.png",
        "forehead_left": "identity_anum_med.png",
        "forehead_right": "identity_gender_med.png",
        "temple_left": "identity_dob_small.png",
        "temple_right": "identity_uscis_status_small.png",
        "eyebrow_center": "identity_ctry_citizenship_small.png"
    },
    physical: {
        "cheek_left": "physical_eye_small.png",
        "cheek_right": "physical_hair_small.png",
        "jaw_left": "physical_weight_small.png",
        "jaw_right": "physical_height_small.png",
        "chin": null
    },
    demographics: {
        "nose_tip": "demographics_marital_status_med.png",
        "mouth_left": "demographics_ethnicity_radio.png",
        "mouth_right": "demographics_race_checkbox.png",
        "lip_bottom": "demographics_income_radio.png"
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
    "eyebrow_center": 9,
    "mouth_left": 61,
    "mouth_right": 291,
    "lip_bottom": 18
};

//BODY FIELDS - Using body keypoints for positioning
let allBodyFieldsFlat = [];
let bodyFieldCycleTimer = 0;
let bodyFieldCycleSpeed = 1500; // INCREASED from 1000 for performance
let currentTopBodyFieldIndex = 0;

// REDUCED BOUNCING FIELDS - Cut in half for performance
let bouncingFieldImages = [
    // Core family fields
    "family_father_med.png",
    "family_mother_med.png",
    "family_spouse_med.png",
    "family_children_name_med.png",
    "identity_birthplace_med.png",
    
    // Core work/contact fields
    "work_occupation_med.png",
    "work_employer_med.png",
    "contact_address_med.png",
    "contact_phone_med.png",
    
    // Core travel fields
    "travel_doc_med.png",
    "travel_visa_med.png",
    
    // Essential additional fields only
    "family_children_dob_med.png",
    "family_spouse_citizenship_med.png",
    "legal_employer_med.png",
    "travel_cntry_med.png",
    "identity_anum_med.png",
    
    // Reduced questions (only first 8 instead of 17)
    "questions_1_radio.png",
    "questions_2_radio.png",
    "questions_3_radio.png",
    "questions_4_radio.png",
    "questions_5_radio.png",
    "questions_6_radio.png",
    "questions_7_radio.png",
    "questions_8_radio.png"
];

// Bouncing field objects
let bouncingFields = [];

let showSkeleton = false;

function preload() {
    // Load BodyPose and FaceMesh
    bodyPose = ml5.bodyPose('MoveNet', {
        modelType: 'SINGLEPOSE_LIGHTNING'
    });
    
    faceMesh = ml5.faceMesh({
        maxFaces: 1,
        refineLandmarks: false,
        flipHorizontal: false
    });

    // Load crosshair image
    crosshairImg = loadImage('photos/crosshairs.png');

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
    
    // Load bouncing field images
    for (let filename of bouncingFieldImages) {
        if (!fieldImages[filename]) {
            fieldImages[filename] = loadImage(`photos/form_fields/${filename}`);
        }
    }
    
    console.log(`Loading ${Object.keys(fieldImages).length} form field images...`);
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    //frameRate(45); // REDUCED from default 60fps
    
    // Initialize webcam
    capture = createCapture(VIDEO);
    capture.size(640, 480);
    capture.hide();
    
    // Start detection systems
    bodyPose.detectStart(capture, gotPoses);
    faceMesh.detectStart(capture, gotFaces);
    
    // Initialize bouncing fields and field cycling
    initializeBouncingFields();
    initializeFieldCycling();
    initializeBodyFieldCycling();
}

function initializeFieldCycling() {
    allFaceFieldsFlat = [];
    
    for (let layerName in faceLayeredFields) {
        for (let landmarkName in faceLayeredFields[layerName]) {
            let filename = faceLayeredFields[layerName][landmarkName];
            if (filename && fieldImages[filename]) {
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
    allBodyFieldsFlat = [...bouncingFieldImages];
    console.log(`Initialized body field cycling with ${allBodyFieldsFlat.length} fields`);
}

function initializeBouncingFields() {
    bouncingFields = [];
    
    for (let i = 0; i < bouncingFieldImages.length; i++) {
        let filename = bouncingFieldImages[i];
        bouncingFields.push({
            filename: filename,
            x: random(windowWidth * 0.2, windowWidth * 0.8),
            y: random(windowHeight * 0.15, windowHeight * 0.85),
            vx: random(-1.5, 1.5), // REDUCED speed for performance
            vy: random(-1.5, 1.5),
            minSpeed: 0.3, // REDUCED minimum speed
            maxSpeed: 1.5  // REDUCED maximum speed
        });
    }
    
    console.log(`Initialized ${bouncingFields.length} bouncing fields in organic distribution`);
}

// PERFORMANCE OPTIMIZATION: Limit detection frequency
function gotPoses(results) {
    if (frameCount - lastBodyDetection > 8) { // Every 8 frames instead of every frame
        poses = results;
        lastBodyDetection = frameCount;
    }
}

function gotFaces(results) {
    if (frameCount - lastFaceDetection > 12) { // Every 12 frames instead of every frame
        faces = results;
        lastFaceDetection = frameCount;
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

function draw() {
    background(240, 240, 250);
    
    // Check if person is detected
    let personDetected = poses.length > 0 && poses[0].keypoints.some(kp => kp.confidence > 0.3);
    
    if (personDetected) {
        lastPersonDetectedTime = millis();
        isIdleState = false;
    } else if (millis() - lastPersonDetectedTime > idleTimeout) {
        isIdleState = true;
    }
    
    if (isIdleState) {
        // Draw idle screen
        drawIdleScreen();
    } else {
        // Draw administrative side (no coordinate translation needed in 2D mode)
        drawAdministrativeSide();
    }
}

function drawIdleScreen() {
    // Update queue number periodically (every 8-12 seconds)
    if (millis() - lastQueueUpdate > random(8000, 12000)) {
        currentQueueNumber += floor(random(1, 4));
        lastQueueUpdate = millis();
    }
    
    // Responsive sizing based on screen dimensions
    let isPortrait = height > width;
    let baseSize = min(width, height);
    
    // Responsive text sizes
    let queueTextSize = baseSize * 0.04;
    let mainTextSize = baseSize * 0.08;
    let instructionTextSize = baseSize * 0.035;
    let footerTextSize = baseSize * 0.025;
    
    // Responsive positioning
    let topSpacing = height * 0.15;
    let centerY = height * 0.42;
    let bottomSpacing = height * 0.5;
    
    // Queue number (H3 equivalent)
    fill(102, 102, 102);
    textAlign(CENTER, CENTER);
    textSize(queueTextSize);
    textFont('Helvetica');
    text(`NOW SERVING: APPLICANT #${currentQueueNumber.toString().padStart(3, '0')}`, 
         width/2, topSpacing);
    
    // Main instruction (H1 equivalent)
    fill(26, 26, 26);
    textSize(mainTextSize);
    textStyle(BOLD);
    
    if (isPortrait && width < height * 0.7) {
        text("PLEASE STEP HERE", width/2, centerY - mainTextSize * 1.2);
        text("FOR ID PHOTO", width/2, centerY - mainTextSize * 0.3);
    } else {
        text("PLEASE STEP HERE FOR ID PHOTO", width/2, centerY - baseSize * 0.12);
    }
    
    // Crosshair/viewfinder
    drawCrosshair();
    
    // Instructions
    fill(68, 68, 68);
    textSize(instructionTextSize);
    textStyle(NORMAL);
    
    let instructionY1 = centerY + baseSize * 0.6;
    let instructionY2 = centerY + baseSize * 0.66;
    
    text("STAND ON DESIGNATED AREA", width/2, instructionY1);
    
    // Blinking indicator for camera instruction
    let blinkOn = (millis() % 1500) < 750;
    let cameraText = "LOOK DIRECTLY INTO CAMERA";
    text(cameraText, width/2 - instructionTextSize * 0.4, instructionY2);
    
    if (blinkOn) {
        fill(255, 68, 68);
        let dotSize = instructionTextSize * 0.4;
        ellipse(width/2 + textWidth(cameraText)/2, instructionY2, dotSize, dotSize);
    }
}

function drawCrosshair() {
    if (!crosshairImg) return;
    
    push();
    translate(width/2, height/2 + height * 0.05);
    
    let baseSize = min(width, height);
    let crosshairSize = baseSize * 0.25;
    
    crosshairPulse += 0.02;
    let pulseScale = 1 + sin(crosshairPulse) * 0.05;
    scale(pulseScale);
    
    imageMode(CENTER);
    image(crosshairImg, 0, 0, crosshairSize, crosshairSize);
    imageMode(CORNER);
    
    pop();
}

function drawAdministrativeSide() {
    // Draw webcam feed
    if (capture.loadedmetadata) {
        image(capture, 0, 0, windowWidth, windowHeight);
        
        // REDUCED blur for performance
        filter(BLUR, 4); // REDUCED from 8
        
        noTint();
    }
    
    // Draw bouncing body fields
    drawBouncingFields();
    
    // Draw layered face fields
    drawFaceMeshLayeredFields();
    
    if (showSkeleton) {
        drawSkeleton();
    }
}

function drawBouncingFields() {
    if (poses.length === 0) return;

    // SLOWER body field cycling for performance
    if (millis() - bodyFieldCycleTimer > bodyFieldCycleSpeed) {
        currentTopBodyFieldIndex = Math.floor(random(allBodyFieldsFlat.length));
        bodyFieldCycleTimer = millis();
        console.log(`Body field cycle: ${allBodyFieldsFlat[currentTopBodyFieldIndex]} now on top`);
    }

    let topBodyField = allBodyFieldsFlat[currentTopBodyFieldIndex];
    let pose = poses[0];
    let bodyBounds = getBodyBounds(pose);
    if (!bodyBounds) return;
    
    // Update and draw bouncing fields
    for (let field of bouncingFields) {
        // Update position
        field.x += field.vx;
        field.y += field.vy;
        
        let fieldImg = fieldImages[field.filename];
        if (!fieldImg) continue;
        
        // Bounce off boundaries
        if (field.x <= bodyBounds.minX || field.x + fieldImg.width >= bodyBounds.maxX) {
            field.vx *= -1;
            field.x = constrain(field.x, bodyBounds.minX, bodyBounds.maxX - fieldImg.width);
        }
        if (field.y <= bodyBounds.minY || field.y + fieldImg.height >= bodyBounds.maxY) {
            field.vy *= -1;
            field.y = constrain(field.y, bodyBounds.minY, bodyBounds.maxY - fieldImg.height);
        }
        
        // Maintain speed
        if (abs(field.vx) < field.minSpeed) field.vx = field.vx > 0 ? field.minSpeed : -field.minSpeed;
        if (abs(field.vy) < field.minSpeed) field.vy = field.vy > 0 ? field.minSpeed : -field.minSpeed;
        field.vx = constrain(field.vx, -field.maxSpeed, field.maxSpeed);
        field.vy = constrain(field.vy, -field.maxSpeed, field.maxSpeed);
        
        // Draw field (top field drawn last for layering)
        if (field.filename !== topBodyField) {
            image(fieldImg, field.x, field.y);
        }
    }
    
    // Draw top field last
    for (let field of bouncingFields) {
        if (field.filename === topBodyField) {
            let fieldImg = fieldImages[field.filename];
            if (fieldImg) {
                image(fieldImg, field.x, field.y);
            }
            break;
        }
    }
}

function getBodyBounds(pose) {
    let validKeypoints = pose.keypoints.filter(kp => kp.confidence > 0.3);
    if (validKeypoints.length === 0) return null;
    
    let scaledKeypoints = validKeypoints.map(kp => ({
        x: map(kp.x, 0, capture.width, 0, windowWidth),
        y: map(kp.y, 0, capture.height, 0, windowHeight)
    }));
    
    let minX = Math.min(...scaledKeypoints.map(kp => kp.x)) - 50;
    let maxX = Math.max(...scaledKeypoints.map(kp => kp.x)) + 50;
    let minY = Math.min(...scaledKeypoints.map(kp => kp.y)) - 50;
    let maxY = Math.max(...scaledKeypoints.map(kp => kp.y)) + 50;
    
    return {
        minX: Math.max(0, minX),
        maxX: Math.min(windowWidth, maxX),
        minY: Math.max(0, minY),
        maxY: Math.min(windowHeight, maxY)
    };
}

function drawFaceMeshLayeredFields() {
    if (faces.length === 0 || allFaceFieldsFlat.length === 0) return;
    
    let face = faces[0];
    
    // SLOWER face field cycling for performance
    if (millis() - fieldCycleTimer > fieldCycleSpeed) {
        currentTopFieldIndex = (currentTopFieldIndex + 1) % allFaceFieldsFlat.length;
        fieldCycleTimer = millis();
        let currentField = allFaceFieldsFlat[currentTopFieldIndex];
        console.log(`Field cycle: ${currentField.displayName} now on top`);
    }
    
    let topField = allFaceFieldsFlat[currentTopFieldIndex];
    let layers = ['demographics', 'physical', 'identity'];
    
    // Draw all fields except top field
    for (let layer of layers) {
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
                if (layer === topField.layer && landmarkName === topField.landmark) {
                    continue;
                }
                drawSingleFaceField(face, layer, landmarkName, imageFilename, false);
            }
        }
    }
    
    // Draw top field last
    drawSingleFaceField(face, topField.layer, topField.landmark, topField.filename, true);
}

function drawSingleFaceField(face, layer, landmarkName, imageFilename, isTopField) {
    let landmarkIndex = faceLandmarkMap[landmarkName];
    if (landmarkIndex === undefined || !face.keypoints[landmarkIndex]) return;
    
    let landmark = face.keypoints[landmarkIndex];
    let x = landmark.x * (windowWidth / capture.width);
    let y = landmark.y * (windowHeight / capture.height);
    
    let layerOffsetX = layer === 'physical' ? 10 : (layer === 'demographics' ? 20 : 0);
    let layerOffsetY = layer === 'physical' ? 5 : (layer === 'demographics' ? 10 : 0);
    
    let offsetX = x + layerOffsetX;
    let offsetY = y + layerOffsetY;
    
    if (imageFilename === "identity_ssn_med.png") {
        offsetY = offsetY - 80;
    }
    
    let fieldImg = fieldImages[imageFilename];
    
    offsetX = offsetX - (fieldImg.width / 2) + layerOffsetX;
    offsetY = offsetY - (fieldImg.height / 2) + layerOffsetY;
    
    offsetX = constrain(offsetX, 0, windowWidth - fieldImg.width);
    offsetY = constrain(offsetY, 0, windowHeight - fieldImg.height);
    
    image(fieldImg, offsetX, offsetY);
}

function drawSkeleton() {
    if (poses.length === 0) return;
    
    let pose = poses[0];
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

// function keyPressed() {
//     if (key === 's' || key === 'S') {
//         showSkeleton = !showSkeleton;
//         console.log('Skeleton view:', showSkeleton ? 'ON' : 'OFF');
//     }
// }