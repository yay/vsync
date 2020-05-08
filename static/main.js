const player = document.querySelector('#player');
const skipNegBtn = document.querySelector('#skip-neg-btn');
const skipPosBtn = document.querySelector('#skip-pos-btn');
const playBtn = document.querySelector('#play-btn');
const socket = io();

socket.on('disconnect', () => {
    alert('Connection lost.');
});

let suppressEmitSeek = false;
socket.on('seek', time => {
    suppressEmitSeek = true;
    player.currentTime = time;
});

socket.on('play', () => player.play());
socket.on('pause', () => player.pause());

player.focus();
player.addEventListener('blur', () => player.focus());
updatePlayBtn();

player.addEventListener('play', () => {
    socket.emit('play');
    updatePlayBtn();
});
player.addEventListener('pause', () => {
    socket.emit('pause');
    updatePlayBtn();
});

player.addEventListener('seeked', () => {
    if (suppressEmitSeek) {
        suppressEmitSeek = false;
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