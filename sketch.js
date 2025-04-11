let video0, video1, liveVideo;
let dreamVideos = [];
let currentVideos = [];
let videoQueue = [];
let videoFileName;
let thermalStart = 15; // seconds into the video to start thermal effects
let steps = 10;
let opacStep;
let mic, fft, amplitude, threshold = 0.01;
let threshold2 = 0.02; // second volume threshold for triggering live feed
let isStarted = false; // to ensure one-time initialization
let thermalApplied = false; // flag to check if thermal effect is applied
let liveTimer = 0, extendTimer = 0; // timers for live feed
let isLive = false; // whether the live webcam is active
let liveAudio;
let w = 202;
let h = 105;

function preload() {
  // Load video files and set crossOrigin so that loadPixels works.
  video0 = createVideo(['video0.mp4']);
  video0.elt.crossOrigin = "anonymous";
  video0.hide();
  
  video1 = createVideo(['test.mp4']);
  video1.elt.crossOrigin = "anonymous";
  video1.hide();
  
  // Preload dream videos (dream1.mp4 ... dream12.mp4)
  for (let i = 1; i <= 12; i++) {
    let dv = createVideo([`dream${i}.mp4`]);
    dv.elt.crossOrigin = "anonymous";
    dv.hide();
    dreamVideos.push(dv);
  }
  
  // Load live audio if needed
  liveAudio = loadSound('live_audio.mp3');
}

function setup() {
  console.log("setup() ran");
  createCanvas(2000, 1200);
  frameRate(30);
  pixelDensity(1);
  opacStep = 255 / steps;
  background(0); // Black background

  // Use default webcam input from the browser.
  liveVideo = createCapture(VIDEO);
  liveVideo.elt.crossOrigin = "anonymous";
  liveVideo.size(w, h);
  liveVideo.hide();
  
  // Audio processing
  fft = new p5.FFT();
  setupAudio();
  
  // Optional: Wait for video1's metadata and log its duration.
  video1.onloadedmetadata = () => {
    console.log("Duration of test.mp4:", formatTime(video1.duration()));
  };
  
  // Also add a callback for video0 to know it's loaded.
  video0.onloadedmetadata = () => {
    console.log("video0.mp4 loaded, duration:", formatTime(video0.duration()));
  };
}

function formatTime(seconds) {
  let minutes = Math.floor(seconds / 60);
  let remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function mousePressed() {
  // Ensure a user gesture triggers audio.
  userStartAudio(); 
  console.log("Mouse pressed, starting sketch");
  if (!isStarted) {
    initializeVideos();
    isStarted = true;
  }
}

function initializeVideos() {
  // Start with video0; add it to the currentVideos array and play it.
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
  // Initialize the microphone and then set amplitude and fft.
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
  background(0);
  console.log("draw() running");

  // We now assume isStarted is true (after clicking) and amplitude is set.
  if (isStarted && amplitude) {
    let vol = amplitude.getLevel();
    console.log("Volume level:", vol);

    // Calculate centered position for videos.
    let xOffset = (width - w) / 2;
    let yOffset = (height - h) / 2;

    let playingDreamVideo = currentVideos.some(video => dreamVideos.includes(video));

    if (!isLive) {
      currentVideos.forEach(video => {
        video.loadPixels();
        if (video.pixels.length > 0) {
          // Determine if thermal effect should apply.
          let applyThermal = thermalApplied || video.time() > thermalStart;
          if (applyThermal) {
            thermalApplied = true;
            // Uncomment the next line to apply the thermal effect.
            applyThermalEffect(video);
          }
          video.updatePixels();
        }
        image(video, xOffset, yOffset, w, h);
      });
      
      if (vol > threshold2 && !isLive && playingDreamVideo) {
        console.log("Triggering live feed due to high volume.");
        startLiveFeed();
      }
      
      if (vol > threshold && !playingDreamVideo &&
          (videoFileName === 'video0.mp4' || videoFileName === 'test.mp4') && thermalApplied) {
        console.log("Switching to dream videos due to volume threshold.");
        switchRandomDreamVideos();
      }
    } else {
      // Handle the live webcam feed.
      manageLiveInput();
    }
  } else {
    // Draw waiting message if not started.
    fill(255);
    textSize(24);
    text("Waiting for microphone... Click to start.", 10, 30);
  }
}

function manageLiveInput() {
  showLiveVideo();
  let currentDuration = millis() - liveTimer;
  if (currentDuration > 30000) {
    endLiveFeed();
  }
}

function showLiveVideo() {
  liveVideo.loadPixels();
  applyThermalEffect(liveVideo);
  liveVideo.updatePixels();
  let xOffset = (width - liveVideo.width) / 2;
  let yOffset = (height - liveVideo.height) / 2;
  image(liveVideo, xOffset, yOffset, liveVideo.width, liveVideo.height);
}

function startLiveFeed() {
  stopAllVideos();
  liveTimer = millis();
  isLive = true;
  liveVideo.play();
  liveAudio.play();  // Play live audio if desired.
}

function endLiveFeed() {
  isLive = false;
  liveAudio.stop();
  switchToTest();
}

function applyThermalEffect(video) {
  // Loop through pixels and apply a thermal color mapping.
  // (Temporarily you can comment this out to test raw video display.)
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
  stopAllVideos();
  let numVideos = Math.floor(Math.random() * 2) + 1;
  videoQueue = [];
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
    indices.add(Math.floor(Math.random() * max));
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

