// Game constants and variables
        const GAME_DURATION = 48000; // 60 seconds in milliseconds
        const NOTE_SPEED = 400; // pixels per second
        let score = 0;
        let combo = 0;
        let gameStarted = false;
        let gameEnded = false;
        let audioElement = null;
        let gameStartTime = 0;
        const AUDIO_FILE = 'tune.mp3'; // The fixed audio file name
        const TARGET_POSITION = 100; // Position from bottom where notes should be hit
        
        // Default beatmap - simplified for testing
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
        
        // DOM elements
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
        
        // Create stars for background
        function createStars() {
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
        
        // Event listeners for game controls
        playButton.addEventListener('click', startGame);
        restartButton.addEventListener('click', restartGame);
        
        // Preload audio
        function preloadAudio() {
            audioStatus.textContent = "Preloading audio...";
            
            // Create audio element
            const audio = new Audio();
            
            // Set up event listeners
            audio.addEventListener('canplaythrough', function() {
                audioElement = audio;
                audioStatus.textContent = "Audio preloaded successfully!";
            }, { once: true });
            
            audio.addEventListener('error', function() {
                console.error('Error preloading audio:', audio.error);
                audioStatus.textContent = `Audio preload error: ${audio.error ? audio.error.message : 'unknown'}`;
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
                        audioStatus.textContent = "Audio playing!";
                    }).catch(err => {
                        console.error('Error playing audio:', err);
                        audioStatus.textContent = `Audio play error: ${err.message}`;
                    });
                }
            } else {
                // Try creating audio element directly
                const audio = new Audio(AUDIO_FILE);
                audio.play().then(() => {
                    audioElement = audio;
                    audioStatus.textContent = "Audio playing (retry)!";
                }).catch(err => {
                    console.error('Error playing new audio:', err);
                    audioStatus.textContent = `New audio error: ${err.message}`;
                });
            }
        }
        
        // Create a note element
        function createNote(track) {
            const note = document.createElement('div');
            note.classList.add('note');
            
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
            
            // Position at top of screen initially
            note.style.top = '0px';
    note.dataset.hit = 'false';
            gameArea.appendChild(note);
            
            return note;
        }
        
        // Simple note animation
        function animateNote(note, track) {
            const gameHeight = gameArea.clientHeight;
            const fallDuration = 2000; // 2 seconds to fall
            const startTime = Date.now();
            
            function moveNote() {
                if (gameEnded) {
                    note.remove();
                    return;
                }
                
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / fallDuration, 1);
                const position = progress * gameHeight;
                
                note.style.top = `${position}px`;
                
                if (progress >= 1.05 && note.dataset.hit !== 'true') {
                    note.remove();
                    missNote();
                } else {
                    requestAnimationFrame(moveNote);
                }
            }
            
            requestAnimationFrame(moveNote);
        }
        
        // Create explosion animation
        function createExplosion(x, y, color) {
            const explosion = document.createElement('div');
            explosion.classList.add('explosion');
            explosion.style.left = `${x}px`;
            explosion.style.top = `${y}px`;
            explosion.style.backgroundColor = color;
            gameArea.appendChild(explosion);
            
            setTimeout(() => {
                explosion.remove();
            }, 300);
        }
        
        // Handle hitting a note
        function hitNote(track) {
            if (!gameStarted || gameEnded) return;
            
            const trackClass = track === 0 ? 'leftNote' : track === 1 ? 'centerNote' : 'rightNote';
            const notes = document.querySelectorAll(`.note.${trackClass}`);
            if (notes.length === 0) return;
            
            // Find the closest note to the target zone
            const gameHeight = gameArea.clientHeight;
            const targetY = gameHeight - TARGET_POSITION;
            let closestNote = null;
            let closestDistance = Infinity;
            
            notes.forEach(note => {
                const noteTop = parseInt(note.style.top) || 0;
                const distance = Math.abs(noteTop - targetY);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestNote = note;
                }
            });
            
            if (!closestNote) return;
            
            // Check if note is in hit range (100px window)
            if (closestDistance <= 100) {
                // Determine score based on accuracy
                let points = 0;
                if (closestDistance <= 20) {
                    points = 100; // Perfect
                } else if (closestDistance <= 50) {
                    points = 50; // Good
                } else {
                    points = 10; // OK
                }
                
                // Apply combo multiplier
                combo++;
                const multiplier = Math.min(Math.floor(combo / 10) + 1, 4);
                points *= multiplier;
                
                // Update score
                score += points;
                scoreValue.textContent = score;
                comboValue.textContent = combo;
                
                // Create explosion
                const noteRect = closestNote.getBoundingClientRect();
                const color = window.getComputedStyle(closestNote).backgroundColor;
                createExplosion(noteRect.left + noteRect.width / 2, noteRect.top + noteRect.height / 2, color);
                
                // Remove hit note
                closestNote.dataset.hit = 'true';
                closestNote.remove();
            }
        }
        
        // Handle missing a note
        function missNote() {
            combo = 0;
            comboValue.textContent = combo;
        }
        
        // Handle keyboard input
        function handleKeyDown(e) {
            if (!gameStarted || gameEnded) return;
            
            switch (e.key.toLowerCase()) {
                case 'a':
                    hitNote(0);
                    break;
                case 's':
                    hitNote(1);
                    break;
                case 'd':
                    hitNote(2);
                    break;
            }
        }
        
        // Handle touch input for mobile
        function setupTouchControls() {
            const leftTrack = document.getElementById('leftTrack');
            const centerTrack = document.getElementById('centerTrack');
            const rightTrack = document.getElementById('rightTrack');
            
            leftTrack.addEventListener('touchstart', (e) => {
                e.preventDefault();
                hitNote(0);
            });
            
            centerTrack.addEventListener('touchstart', (e) => {
                e.preventDefault();
                hitNote(1);
            });
            
            rightTrack.addEventListener('touchstart', (e) => {
                e.preventDefault();
                hitNote(2);
            });
        }
        
        // Generate notes with simple timing
        
// Generate notes based on beatMap in seconds
function generateNotesFromBeatMap() {
    const startTimestamp = Date.now();
    beatMap.forEach(([beatTimeSec, track]) => {
        const delay = beatTimeSec * 1000;
        setTimeout(() => {
            if (!gameEnded) {
                const note = createNote(track);
                animateNote(note, track);
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
            
            // Start generating notes immediately
            generateNotesFromBeatMap();
            
            // End game after duration
            setTimeout(endGame, GAME_DURATION);
        }
        
        // Restart game
        function restartGame() {
            endScreen.style.display = 'none';
            mainMenu.style.display = 'flex';
            gameArea.style.display = 'none';
            
            // Remove all notes
            const notes = document.querySelectorAll('.note');
            notes.forEach(note => note.remove());
            
            // Reset audio
            if (audioElement) {
                audioElement.pause();
                audioElement.currentTime = 0;
            }
            
            gameStarted = false;
            gameEnded = false;
        }
        
        // Initialize game
        function init() {
            document.addEventListener('keydown', handleKeyDown);
            setupTouchControls();
            createStars();
            
            // Preload audio
            preloadAudio();
            
            // Add user interaction handler for audio (browser policy)
            document.addEventListener('click', function initAudioOnFirstClick() {
                if (audioElement && audioElement.paused) {
                    audioElement.play().then(() => {
                        audioStatus.textContent = "Audio activated by click!";
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