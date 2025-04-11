let video0, video1, liveVideo;
let dreamVideos = [];
let currentVideos = [];
let videoQueue = [];
let videoFileName;
let thermalStart = 15; // Time in seconds to start applying thermal effects
let steps = 10;
let opacStep;
let mic, fft, amplitude, threshold = 0.01;
let threshold2 = 0.02; // Second volume threshold for extending live input
let isStarted = false; // Flag to prevent multiple initializations
let thermalApplied = false; // Flag to check if thermal effect is applied
let liveTimer = 0, extendTimer = 0; // Timers for live input
let isLive = false; // Flag: is the live webcam on?
let liveAudio;
let w = 202;
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
  background(0); // Black background

  // Use default webcam input (no external camera)
  liveVideo = createCapture(VIDEO);
  liveVideo.size(w, h);
  liveVideo.hide();
  
  fft = new p5.FFT();
  fft.setInput(mic);
  
  setupAudio();

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

    // Calculate position to center the video on canvas
    let xOffset = (width - w) / 2;
    let yOffset = (height - h) / 2;

    // Check if any dream video is currently playing
    let playingDreamVideo = currentVideos.some(video => dreamVideos.includes(video));
    
    // If a high amplitude sound is detected and a dream video is playing, trigger the live webcam feed
    if (vol > threshold2 && !isLive && playingDreamVideo) {
      console.log("Triggering live feed due to high frequency sound.");
      startLiveFeed(); // Start showing live webcam feed
    }

    // Regular video/dream video playback
    if (!isLive) {
      // Switch to dream videos if the volume threshold is met, no dream video is playing, and thermal effect is active
      if (vol > threshold && !playingDreamVideo && 
          (videoFileName === 'video0.mp4' || videoFileName === 'test.mp4') && thermalApplied) {
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
        image(video, xOffset, yOffset, w, h); // Draw the video centered
      });
    } else {
      // Live webcam feed management
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
  showLiveVideo();  // Display the live webcam with thermal effect
  // End live feed after 30 seconds
  let currentDuration = millis() - liveTimer;
  if (currentDuration > 30000) {  // After 30 seconds
    endLiveFeed();  // Switch back to test.mp4
  }
}

function showLiveVideo() {
  liveVideo.loadPixels();  // Load pixel data
  applyThermalEffect(liveVideo); // Apply thermal effect
  liveVideo.updatePixels(); 
  let xOffset = (width - liveVideo.width) / 2;
  let yOffset = (height - liveVideo.height) / 2;
  image(liveVideo, xOffset, yOffset, liveVideo.width, liveVideo.height);
}

function startLiveFeed() {
  stopAllVideos(); // Stop all other videos
  
  liveTimer = millis();
  isLive = true;
  liveVideo.play();
  liveAudio.play();  // Play live audio if required
}

function endLiveFeed() {
  isLive = false;
  liveAudio.stop();  // Stop the live audio
  switchToTest(); // Switch back to test video
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
        b = 0;
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
  stopAllVideos(); // Stop current videos
  let numVideos = Math.floor(Math.random() * 2) + 1; // Randomly select 1 or 2 videos
  videoQueue = []; // Clear queue
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
    let video = videoQueue.shift();
    video.play();
    video.onended(playVideoFromQueue);
    currentVideos = [video];
  } else {
    switchToTest();
  }
}

function switchToTest() {
  stopAllVideos();
  currentVideos = [video1];
  videoFileName = 'test.mp4';
  
  // Set a random start time within the test video duration
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
