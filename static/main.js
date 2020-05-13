const player = document.querySelector('#player');
const skipNegBtn = document.querySelector('#skip-neg-btn');
const skipPosBtn = document.querySelector('#skip-pos-btn');
const playBtn = document.querySelector('#play-btn');
const socket = io();

socket.on('disconnect', () => {
    alert('Connection lost.');
});

let seekedRemotely = false;
let playedRemotely = false;
let pausedRemotely = false;

socket.on('seek', time => {
    seekedRemotely = true;
    playedRemotely = true;
    player.currentTime = time;
    player.play();
});

socket.on('play', time => {
    seekedRemotely = true;
    playedRemotely = true;
    player.currentTime = time;
    player.play();
});
socket.on('pause', time => {
    seekedRemotely = true;
    pausedRemotely = true;
    player.currentTime = time;
    player.pause();
});

player.focus();
player.addEventListener('blur', () => player.focus());
updatePlayBtn();

player.addEventListener('play', () => {
    if (playedRemotely) {
        playedRemotely = false;
        return;
    }
    socket.emit('play', player.currentTime);
    updatePlayBtn();
});
player.addEventListener('pause', () => {
    if (pausedRemotely) {
        pausedRemotely = false;
        return;
    }
    socket.emit('pause', player.currentTime);
    updatePlayBtn();
});

player.addEventListener('seeked', () => {
    if (seekedRemotely) {
        seekedRemotely = false;
        return;
    }
    socket.emit('seek', player.currentTime);
});

skipNegBtn.addEventListener('click', () => {
    player.currentTime -= 10;
});

skipPosBtn.addEventListener('click', () => {
    player.currentTime += 10;
});

playBtn.addEventListener('click', () => {
    player.paused && player.play() || player.pause();
});

function updatePlayBtn() {
    playBtn.textContent = player.paused ? '⏸️' : '▶️';
}