// Game constants and variables
const GAME_DURATION = 48000; // 48 seconds in milliseconds
const NOTE_SPEED = 400; // pixels per second
let score = 0;
let combo = 0;
let gameStarted = false;
let gameEnded = false;
let audioElement = null;
let gameStartTime = 0;
const AUDIO_FILE = 'tune.mp3'; // The fixed audio file name
const TARGET_POSITION = 140; // Position from bottom where notes should be hit (matched with CSS)
const HIT_WINDOW = 100; // Hit detection window in pixels
let animationFrameId = null; // Store requestAnimationFrame ID for cancellation

// Beatmap - timestamps in seconds and track (0=left, 1=center, 2=right)
let beatMap = [
    [0.9, 0], [1.48, 1], [2.11, 2], [3.01, 0], [3.61, 1],
    [4.32, 2], [4.98, 0], [6.16, 1], [6.9, 2], [7.93, 0],
    [8.64, 1], [9.31, 2], [10.42, 0], [11.42, 1], [12.53, 2],
    [13.39, 0], [14.13, 1], [15.06, 2], [15.75, 0], [16.9, 1],
    [18.01, 2], [18.89, 0], [19.6, 1], [20.24, 2], [21.41, 0],
    [22.02, 1], [22.82, 2], [23.84, 0], [24.87, 1], [25.47, 2],
    [26.48, 0], [27.2, 1], [28.2, 2], [29.3, 0], [30.37, 1],
    [31.03, 2], [31.75, 0], [32.43, 1], [33.28, 2], [34.47, 0],
    [35.18, 1], [36.13, 2], [37.04, 0], [37.8, 1], [38.7, 2],
    [39.7, 0], [41.0, 1], [42.16, 2], [43.0, 0], [43.78, 1],
    [44.59, 2], [45.43, 0], [46.32, 1]
];

// Cache DOM elements
const mainMenu = document.getElementById('mainMenu');
const gameArea = document.getElementById('gameArea');
const endScreen = document.getElementById('endScreen');
const playButton = document.getElementById('playButton');
const restartButton = document.getElementById('restartButton');
const scoreValue = document.getElementById('scoreValue');
const comboValue = document.getElementById('comboValue');
const finalScore = document.getElementById('finalScore');
const starsContainer = document.getElementById('starsContainer');
const audioStatus = document.getElementById('audioStatus');
const leftTrack = document.getElementById('leftTrack');
const centerTrack = document.getElementById('centerTrack');
const rightTrack = document.getElementById('rightTrack');
const touchLeft = document.querySelector('.touch-left');
const touchCenter = document.querySelector('.touch-center');
const touchRight = document.querySelector('.touch-right');

// Object pools for better performance
const notePool = [];
const explosionPool = [];
const MAX_POOL_SIZE = 20;

// Create object pools
function initObjectPools() {
    // Create note pool
    for (let i = 0; i < MAX_POOL_SIZE; i++) {
        const note = document.createElement('div');
        note.classList.add('note');
        note.style.display = 'none';
        gameArea.appendChild(note);
        notePool.push(note);
    }
    
    // Create explosion pool
    for (let i = 0; i < MAX_POOL_SIZE; i++) {
        const explosion = document.createElement('div');
        explosion.classList.add('explosion');
        explosion.style.display = 'none';
        gameArea.appendChild(explosion);
        explosionPool.push(explosion);
    }
}

// Get note from pool
function getNote(track) {
    let note = notePool.find(n => n.style.display === 'none');
    
    if (!note) {
        // Create new note if pool is exhausted
        note = document.createElement('div');
        note.classList.add('note');
        gameArea.appendChild(note);
    }
    
    // Reset and configure note
    note.className = 'note';
    note.style.display = 'block';
    note.style.top = '0px';
    note.dataset.hit = 'false';
    note.dataset.track = track;
    
    switch (track) {
        case 0:
            note.classList.add('leftNote');
            break;
        case 1:
            note.classList.add('centerNote');
            break;
        case 2:
            note.classList.add('rightNote');
            break;
    }
    
    return note;
}

// Return note to pool
function recycleNote(note) {
    note.style.display = 'none';
    note.dataset.hit = 'false';
}

// Get explosion from pool
function getExplosion() {
    let explosion = explosionPool.find(e => e.style.display === 'none');
    
    if (!explosion) {
        // Create new explosion if pool is exhausted
        explosion = document.createElement('div');
        explosion.classList.add('explosion');
        gameArea.appendChild(explosion);
    }
    
    explosion.style.display = 'block';
    return explosion;
}

// Return explosion to pool
function recycleExplosion(explosion) {
    setTimeout(() => {
        explosion.style.display = 'none';
    }, 300);
}

// Create stars for background
function createStars() {
    // Clear existing stars first
    starsContainer.innerHTML = '';
    
    for (let i = 0; i < 50; i++) {
        const star = document.createElement('div');
        star.classList.add('star');
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        star.style.width = `${Math.random() * 2 + 1}px`;
        star.style.height = star.style.width;
        star.style.animationDuration = `${Math.random() * 10 + 10}s`;
        star.style.animationDelay = `${Math.random() * 5}s`;
        starsContainer.appendChild(star);
    }
}

// Preload audio
function preloadAudio() {
    audioStatus.textContent = "Preloading audio...";
    
    // Create audio element
    const audio = new Audio();
    
    // Set up event listeners
    audio.addEventListener('canplaythrough', function() {
        audioElement = audio;
        audioStatus.textContent = "Audio ready!";
    }, { once: true });
    
    audio.addEventListener('error', function() {
        console.error('Error preloading audio:', audio.error);
        audioStatus.textContent = `Audio error: ${audio.error ? audio.error.message : 'unknown'}`;
    });
    
    // Start loading
    audio.src = AUDIO_FILE;
    audio.load();
}

// Play audio
function playAudio() {
    if (audioElement) {
        audioElement.currentTime = 0;
        
        const playPromise = audioElement.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                audioStatus.textContent = "";
            }).catch(err => {
                console.error('Error playing audio:', err);
                audioStatus.textContent = `Audio error: ${err.message}`;
            });
        }
    } else {
        // Try creating audio element directly
        const audio = new Audio(AUDIO_FILE);
        audio.play().then(() => {
            audioElement = audio;
            audioStatus.textContent = "";
        }).catch(err => {
            console.error('Error playing new audio:', err);
            audioStatus.textContent = `Audio error: ${err.message}`;
        });
    }
}

// Centralized animation loop for better performance
function gameLoop() {
    if (gameEnded) {
        cancelAnimationFrame(animationFrameId);
        return;
    }
    
    const notes = document.querySelectorAll('.note[style*="display: block"]');
    const gameHeight = gameArea.clientHeight;
    const targetY = gameHeight - TARGET_POSITION;
    const currentTime = Date.now();
    const elapsed = currentTime - gameStartTime;
    
    // Move all active notes
    notes.forEach(note => {
        if (note.dataset.hit === 'true') return;
        
        // Calculate position based on elapsed time
        const noteCreationTime = parseInt(note.dataset.creationTime || gameStartTime);
        const noteElapsed = currentTime - noteCreationTime;
        const fallDuration = 2000; // 2 seconds to fall
        const progress = Math.min(noteElapsed / fallDuration, 1);
        const position = progress * gameHeight;
        
        note.style.top = `${position}px`;
        
        // Auto-remove missed notes
        if (position > gameHeight + 50 && note.dataset.hit !== 'true') {
            recycleNote(note);
            missNote();
        }
    });
    
    animationFrameId = requestAnimationFrame(gameLoop);
}

// Create explosion animation
function createExplosion(x, y, color) {
    const explosion = getExplosion();
    explosion.style.left = `${x}px`;
    explosion.style.top = `${y}px`;
    explosion.style.backgroundColor = color;
    
    recycleExplosion(explosion);
}

// Handle hitting a note
function hitNote(track) {
    if (!gameStarted || gameEnded) return;
    
    const trackClass = track === 0 ? 'leftNote' : track === 1 ? 'centerNote' : 'rightNote';
    const notes = document.querySelectorAll(`.note.${trackClass}[style*="display: block"]`);
    if (notes.length === 0) return;
    
    // Find the closest note to the target zone
    const gameHeight = gameArea.clientHeight;
    const targetY = gameHeight - TARGET_POSITION;
    let closestNote = null;
    let closestDistance = Infinity;
    
    notes.forEach(note => {
        if (note.dataset.hit === 'true') return;
        
        const noteTop = parseInt(note.style.top) || 0;
        const distance = Math.abs(noteTop - targetY);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestNote = note;
        }
    });
    
    if (!closestNote) return;
    
    // Check if note is in hit range
    if (closestDistance <= HIT_WINDOW) {
        // Determine score based on accuracy
        let points = 0;
        let hitText = '';
        
        if (closestDistance <= 20) {
            points = 100; // Perfect
            hitText = 'ATE!';
        } else if (closestDistance <= 50) {
            points = 50; // Good
            hitText = 'NICE!';
        } else {
            points = 10; // OK
            hitText = 'MEH';
        }
        
        // Apply combo multiplier
        combo++;
        const multiplier = Math.min(Math.floor(combo / 10) + 1, 4);
        points *= multiplier;
        
        // Update score
        score += points;
        scoreValue.textContent = score;
        comboValue.textContent = combo;
        
        // Create hit feedback
        showHitFeedback(hitText, closestNote);
        
        // Create explosion
        const noteRect = closestNote.getBoundingClientRect();
        const color = window.getComputedStyle(closestNote).backgroundColor;
        createExplosion(noteRect.left + noteRect.width / 2, noteRect.top + noteRect.height / 2, color);
        
        // Mark as hit and recycle
        closestNote.dataset.hit = 'true';
        recycleNote(closestNote);
    }
}

// Show hit feedback text
function showHitFeedback(text, note) {
    const feedback = document.createElement('div');
    feedback.textContent = text;
    feedback.classList.add('hit-feedback');
    
    // Center the feedback in the game area instead of positioning it based on the note
    gameArea.appendChild(feedback);
    
    // Determine color based on text
    if (text === 'ATE!') {
        feedback.style.color = '#ffdd00';
    } else if (text === 'NICE!') {
        feedback.style.color = '#00ffaa';
    } else {
        feedback.style.color = '#ffffff';
    }
    
    // Remove after animation
    setTimeout(() => {
        feedback.remove();
    }, 1000);
}

// Handle missing a note
function missNote() {
    combo = 0;
    comboValue.textContent = combo;
    
    // Show miss feedback
    const feedback = document.createElement('div');
    feedback.textContent = 'MISS';
    feedback.classList.add('miss-feedback');
    gameArea.appendChild(feedback);
    
    // Remove after animation
    setTimeout(() => {
        feedback.remove();
    }, 1000);
}

// Generate notes based on beatMap in seconds
function generateNotesFromBeatMap() {
    beatMap.forEach(([beatTimeSec, track]) => {
        const delay = beatTimeSec * 1000;
        setTimeout(() => {
            if (!gameEnded) {
                const note = getNote(track);
                note.dataset.creationTime = Date.now().toString();
            }
        }, delay);
    });
}

// End game
function endGame() {
    gameEnded = true;
    finalScore.textContent = score;
    gameArea.style.display = 'none';
    endScreen.style.display = 'flex';
    
    if (audioElement) {
        audioElement.pause();
    }
    
    // Clean up
    cancelAnimationFrame(animationFrameId);
    
    // Clean up active notes
    const notes = document.querySelectorAll('.note[style*="display: block"]');
    notes.forEach(note => {
        recycleNote(note);
    });
}

// Start game
function startGame() {
    score = 0;
    combo = 0;
    gameStarted = true;
    gameEnded = false;
    
    scoreValue.textContent = score;
    comboValue.textContent = combo;
    
    mainMenu.style.display = 'none';
    gameArea.style.display = 'block';
    endScreen.style.display = 'none';
    
    // Start game
    gameStartTime = Date.now();
    playAudio();
    
    // Start animations
    animationFrameId = requestAnimationFrame(gameLoop);
    
    // Start generating notes
    generateNotesFromBeatMap();
    
    // End game after duration
    setTimeout(endGame, GAME_DURATION);
}

// Restart game
function restartGame() {
    endScreen.style.display = 'none';
    mainMenu.style.display = 'flex';
    gameArea.style.display = 'none';
    
    // Clean up active notes
    const notes = document.querySelectorAll('.note[style*="display: block"]');
    notes.forEach(note => {
        recycleNote(note);
    });
    
    // Reset audio
    if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
    }
    
    // Cancel animation
    cancelAnimationFrame(animationFrameId);
    
    gameStarted = false;
    gameEnded = false;
}

// Handle keyboard input
function handleKeyDown(e) {
    if (!gameStarted || gameEnded) return;
    
    switch (e.key.toLowerCase()) {
        case 'a':
            hitNote(0);
            showTrackFeedback(leftTrack);
            break;
        case 's':
            hitNote(1);
            showTrackFeedback(centerTrack);
            break;
        case 'd':
            hitNote(2);
            showTrackFeedback(rightTrack);
            break;
    }
}

// Show visual feedback on track when pressed
function showTrackFeedback(track) {
    track.classList.add('track-active');
    setTimeout(() => {
        track.classList.remove('track-active');
    }, 100);
}

// Improved touch controls for mobile
function setupTouchControls() {
    // Touch left track
    touchLeft.addEventListener('touchstart', (e) => {
        e.preventDefault();
        hitNote(0);
        showTrackFeedback(leftTrack);
    }, { passive: false });
    
    // Touch center track
    touchCenter.addEventListener('touchstart', (e) => {
        e.preventDefault();
        hitNote(1);
        showTrackFeedback(centerTrack);
    }, { passive: false });
    
    // Touch right track
    touchRight.addEventListener('touchstart', (e) => {
        e.preventDefault();
        hitNote(2);
        showTrackFeedback(rightTrack);
    }, { passive: false });
    
    // Add double-tap prevention
    document.addEventListener('touchmove', (e) => {
        if (gameStarted && !gameEnded) {
            e.preventDefault();
        }
    }, { passive: false });
}

// Handle device orientation changes
function handleOrientationChange() {
    // Force redraw to fix mobile layout issues
    gameArea.style.display = 'none';
    setTimeout(() => {
        if (gameStarted && !gameEnded) {
            gameArea.style.display = 'block';
        }
    }, 50);
}

// Initialize game
function init() {
    // Set up event listeners
    document.addEventListener('keydown', handleKeyDown);
    playButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', restartGame);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Initialize game elements
    createStars();
    initObjectPools();
    setupTouchControls();
    
    // Preload audio
    preloadAudio();
    
    // Add user interaction handler for audio (browser policy)
    document.addEventListener('click', function initAudioOnFirstClick() {
        if (audioElement && audioElement.paused) {
            audioElement.play().then(() => {
                audioStatus.textContent = "";
                audioElement.pause(); // Just to enable it, not actually play yet
            }).catch(err => {
                console.error('Error activating audio:', err);
                audioStatus.textContent = `Audio activation error: ${err.message}`;
            });
        }
        document.removeEventListener('click', initAudioOnFirstClick);
    }, { once: true });
}

// Start initialization when the page loads
window.addEventListener('load', init);
