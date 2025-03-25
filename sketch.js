let video0, video1, liveVideo;
let dreamVideos = [];
let currentVideos = [];
let videoQueue = [];
let videoFileName;
let thermalStart = 15; // Time in seconds to start applying thermal effects
let steps = 10;
let opacStep;
let mic, fft, amplitude, threshold = 0.01;
let threshold2 = 0.24; // Second volume threshold for extending live input
let isStarted = false; // Flag to prevent multiple initializations
let thermalApplied = false; // Flag to check if thermal effect is applied
let liveTimer = 0, extendTimer = 0; // Timers for live input
let isLive = false; // Is live camera on
let liveAudio;
let w =202;
let h = 105;

function preload() {
    video0 = createVideo(['video0.mp4']);
    video1 = createVideo(['test.mp4']);
    video0.hide();
    video1.hide();
    
    // Preload dream videos
    for (let i = 1; i <= 12; i++) {
        let dv = createVideo([`dream${i}.mp4`]);
        dv.hide();
        dreamVideos.push(dv);
    }

    liveAudio = loadSound('live_audio.mp3');
}

function setup() {
    console.log("setup() ran");
    createCanvas(2000, 1200);
    frameRate(30);
    pixelDensity(1);
    opacStep = 255 / steps;
    background(0); // Set background to black
  
    let videoSource = '19a570bea438216cbbbe0dea31da0fd17760cdfa0d7b1c57ef6a2fb133a0b470';  // NexiGo N60 FHD Webcam
    // Create video capture from the external camera
    liveVideo = createCapture({
        video: {
            deviceId: videoSource
        }
    });

    liveVideo.size(w, h); // Resize the live video
    liveVideo.hide(); // Hide the video element initially
  
    fft = new p5.FFT();
    fft.setInput(mic);
  
    //setupAudio();

    video1.onloadedmetadata = () => {
        console.log("Duration of test.mp4:", formatTime(video1.duration()));
    };
}

function formatTime(seconds) {
    let minutes = Math.floor(seconds / 60);
    let remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
}

function mousePressed() {
  userStartAudio(); 
  console.log("Mouse pressed, starting sketch");
  if (!isStarted) {
    initializeVideos();
    setupAudio();
    isStarted = true;
  }
}



function initializeVideos() {
    currentVideos.push(video0);
    videoFileName = 'video0.mp4';
    video0.play();
    thermalApplied = false;
    video0.onended(() => {
        console.log("video0.mp4 has ended. Switching to test.mp4.");
        switchToTest();
    });
  
    video1.onended(() => {
        console.log("test.mp4 has ended. Looping test.mp4.");
        currentVideos = [video1];
        video1.time(0);
        video1.play();
    });
}

function setupAudio() {
    mic = new p5.AudioIn();
    mic.start(() => {
        console.log("Microphone is ready.");
        amplitude = new p5.Amplitude();
        amplitude.setInput(mic);
        fft = new p5.FFT(0.8, 1024);
        fft.setInput(mic);
    }, () => {
        console.log("Error starting the microphone.");
    });
}

function draw() {
  console.log("draw() running");
  
  // Only proceed if the sketch has started and the microphone (amplitude) is ready
  if (isStarted && amplitude) {
    let vol = amplitude.getLevel();  // Get the current volume level
    console.log("Volume level: " + vol);

    // Calculate the position to center the videos
    let xOffset = (width - w) / 2;
    let yOffset = (height - h) / 2;

    // Check if currently any dream video is playing
    let playingDreamVideo = currentVideos.some(video => dreamVideos.includes(video));

    // Check if the high amplitude trigger for live video should activate
    if (vol > threshold2 && !isLive && playingDreamVideo) {
      console.log("Triggering live feed due to high frequency sound.");
      startLiveFeed(); // Start showing live video feed
    }

    // Manage the regular video or dream video playback
    if (!isLive) {
      // Trigger volume-based switching only if no dream videos are playing and the conditions are met
      if (vol > threshold && !playingDreamVideo && (videoFileName === 'video0.mp4' || videoFileName === 'test.mp4') && thermalApplied) {
        console.log("Switching to dream videos due to volume threshold.");
        switchRandomDreamVideos();
      }

      currentVideos.forEach(video => {
        video.loadPixels();
        if (video.pixels.length > 0) {
          let applyThermal = thermalApplied || video.time() > thermalStart;
          if (applyThermal) {
            thermalApplied = true;
            applyThermalEffect(video);
          }
          video.updatePixels();
        }
        image(video, xOffset, yOffset, w, h); // Center the video
      });
    } else {
      // If live feed is active, manage the live feed
      manageLiveInput();
    }
  } else {
    // If not started or microphone isn't ready, show a waiting message
    background(0);
    fill(255);
    textSize(24);
    text("Waiting for microphone...", 10, 30);
  }
}

function manageLiveInput() {
    showLiveVideo();  // Display the live video and apply thermal effect
    // Check if the live video feed should end after 30 seconds
    let currentDuration = millis() - liveTimer;
    if (currentDuration > 30000) {  // After 30 seconds
        endLiveFeed();  // End the live feed and switch back to test.mp4
    }
}

function showLiveVideo() {
    liveVideo.loadPixels();  // Ensure to load pixels if you're going to manipulate them
    applyThermalEffect(liveVideo); // Apply thermal effect to live video
    liveVideo.updatePixels(); // Only needed if pixels were actually manipulated

    // Calculate the position to center the live video
    let xOffset = (width - liveVideo.width) / 2;
    let yOffset = (height - liveVideo.height) / 2;

    image(liveVideo, xOffset, yOffset, liveVideo.width, liveVideo.height); // Show the processed live video
}

function startLiveFeed() {
    stopAllVideos(); // Stop all videos
    
    liveTimer = millis();
    isLive = true;
    liveVideo.play();
    liveAudio.play();  // Start playing the live audio
}

function endLiveFeed() {
    isLive = false;
    liveAudio.stop();  // Stop the live audio
    switchToTest(); // Return to test video
}

function applyThermalEffect(video) {
    for (let x = 0; x < video.width; x++) {
        for (let y = 0; y < video.height; y++) {
            let index = (x + y * video.width) * 4;
            let r = video.pixels[index];
            let g = video.pixels[index + 1];
            let b = video.pixels[index + 2];
            let avg = (r + g + b) / 3;
            let alpha = 255;
            if (avg < 90) {
                r = map(avg, 0, 90, 5, 150);
                g = map(avg, 0, 90, 8, 32);
                b = 220;
            } else if (avg < 190) {
                r = 255;
                g = map(avg, 90, 190, 180, 40);
                b = map(avg, 90, 190, 0, 0);
            } else {
                r = map(avg, 195, 255, 0, 0);
                g = 255;
                b = map(avg, 195, 255, 255, 0);
                alpha = 128;
            }
            video.pixels[index] = r;
            video.pixels[index + 1] = g;
            video.pixels[index + 2] = b;
            video.pixels[index + 3] = alpha;
        }
    }
}

function switchRandomDreamVideos() {
    stopAllVideos(); // Stop all videos
    let numVideos = Math.floor(Math.random() * 2) + 1; // Randomly choose to play 1 or 2 videos
    videoQueue = []; // Reset queue
    let indices = getRandomIndices(dreamVideos.length, numVideos);
    indices.forEach(index => {
        let selectedVideo = dreamVideos[index];
        videoQueue.push(selectedVideo);
    });
    playVideoFromQueue();
}

function getRandomIndices(max, count) {
    let indices = new Set();
    while (indices.size < count) {
        let randomIndex = Math.floor(Math.random() * max);
        indices.add(randomIndex);
    }
    return Array.from(indices);
}

function playVideoFromQueue() {
    if (videoQueue.length > 0) {
        let video = videoQueue.shift(); // Get the first video from the queue
        video.play();
        video.onended(playVideoFromQueue); // Set the next video to play when this one ends
        currentVideos = [video]; // Set current video
    } else {
        // When the queue is empty, switch back to test.mp4
        switchToTest();
    }
}

function switchToTest() {
    stopAllVideos(); // Stop all videos

    currentVideos = [video1];
    videoFileName = 'test.mp4'; // Ensure the videoFileName is updated

    // Set a random timepoint within the duration of the test video
    let randomTime = random(video1.duration());
    video1.time(randomTime);
    video1.elt.onseeked = () => {
        video1.play();
    };
    console.log("Switched to test.mp4 at time:", formatTime(randomTime));
}


function stopAllVideos() {
    video0.stop();
    video1.stop();
    dreamVideos.forEach(video => {
        video.stop();
    });
    liveVideo.stop();
}
