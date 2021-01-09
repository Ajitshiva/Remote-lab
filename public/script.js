const name = prompt("Enter your name");

let socket = io('/');
ace.require("ace/keybindings/sublime");
ace.require("ace/ext/language_tools");
const editor = ace.edit("editor");
editor.session.setMode("ace/mode/python");
editor.setTheme("ace/theme/monokai");
editor.setFontSize(16);
editor.setShowPrintMargin(false);
editor.setKeyboardHandler("ace/keyboard/sublime");
// editor.setOption("enableBasicAutocompletion", true);
editor.setOptions({
    enableBasicAutocompletion: true,
    enableLiveAutocompletion: true
});

const editorDiv = document.getElementById('editor');

editorDiv.addEventListener('keyup', event => {
    const code = editor.getValue();
    socket.emit('code-update', code);
});

const languageSelect = document.getElementById('language-select');
languageSelect.addEventListener('change', event => {
    var language = languageSelect.value;
    var mode = language;
    if(language === 'C' || language === 'C++')  mode = "c_cpp";
    console.log(language.toLowerCase());
    
    editor.session.setMode('ace/mode/' + mode.toLowerCase());
    socket.emit('language-change', language);

});
socket.on('code-update', code => {
    editor.setValue(code)
    editor.clearSelection();
});

socket.on('language-change',language => {
    languageSelect.value = language;
    var mode = language;
    if(language === 'C' || language === 'C++')  mode = "c_cpp";
    console.log(mode.toLowerCase());
    editor.session.setMode('ace/mode/' + mode.toLowerCase());
});

var peer = new Peer(undefined, {
    path: '/peerjs',
    host: '/',
    // port: '443'
    port: '3030'
});

const videoGrid = document.getElementById('video-grid');
const myVideo = document.createElement('video');
myVideo.muted = true;
let myVideoStream;
const peers = {}

navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
}).then(stream => {
    myVideoStream = stream;
    addVideoStream(myVideo, stream);
    peer.on('call', call =>{
        call.answer(stream);
        const video = document.createElement('video');
        call.on('stream', userVideoStream => {
            addVideoStream(video, userVideoStream);
        })
    })
    socket.on('user-connected', (userId) => {
        connectToNewUser(userId, stream);
    })
})

socket.on('user-disconnected', userId => {
    if(peers[userId]) peers[userId].close();
})
peer.on('open', id => {
    
    socket.emit('join-room', ROOM_ID, id, name);
})


const connectToNewUser = (userId, stream) => {
    const call = peer.call(userId, stream);
    const video = document.createElement('video');
    call.on('stream', userVideoStream => {
        addVideoStream(video, userVideoStream);
    })
    call.on('close', ()=> {
        video.remove()
    })

    peers[userId] = call;

}


const addVideoStream = (video, stream) => {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    })
    
    videoGrid.append(video);
}



let text =$('input');

$('html').keydown((e) => {
    if(e.which == 13 && text.val().length !== 0)
    {
        console.log(text.val())
        socket.emit('message', text.val());
        text.val('');
    }
})

socket.on('joinMessage', username =>{
    $('ul').append(`<li class = "join-message"><b>${username}</b> joined the room</li>`);
    scrollToBottom();
})
socket.on('createMessage', (username, message) =>{
    $('ul').append(`<li class = "message"><b>${username}</b><br/>${message}</li>`);
    scrollToBottom();
})
socket.on('leftMessage', username =>{
    $('ul').append(`<li class = "left-message"><b>${username}</b> left the room</li>`);
    scrollToBottom();
})

const scrollToBottom = ()=>{
    let d = $('.main__chat_window');
    d.scrollTop(d.prop("scrollHeight"));
}

const muteUnmute = ()=>{
    const enabled = myVideoStream.getAudioTracks()[0].enabled;
    if(enabled)
    {
        myVideoStream.getAudioTracks()[0].enabled = false;
        setUnmuteButton();
    }
    else{
        setMuteButton();
        myVideoStream.getAudioTracks()[0].enabled = true;
        
    }
}

const setMuteButton = () =>{

    const btn = `<i class = "fas fa-microphone"></i><span>Mute</span>`;
    var mute_btn = document.getElementById('mute__audio');
    mute_btn.innerHTML = btn;
    console.log(mute_btn.innerHTML);
}
const setUnmuteButton = () =>{
    const btn = `<i class = "unmute fas fa-microphone-slash"></i><span>Unmute</span>`;
    var mute_btn = document.getElementById('mute__audio');
    mute_btn.innerHTML = btn;
    console.log(mute_btn.innerHTML);
}


const playStop = () =>{
    let enabled = myVideoStream.getVideoTracks()[0].enabled;
    if(enabled)
    {
        myVideoStream.getVideoTracks()[0].enabled = false;
        setPlayVideo();
    }
    else
    {
        setStopVideo();
        myVideoStream.getVideoTracks()[0].enabled = true;
    }
}

const setPlayVideo = ()=>{
    const html =   `<i class = "stop fas fa-video-slash"></i>
                    <span> Play Video </span>
                    `;
    document.getElementById('mute__video').innerHTML = html;
}
const setStopVideo = ()=>{
    const html =   `<i class = "fas fa-video"></i>
                    <span> Stop Video </span>
                    `;
    document.getElementById('mute__video').innerHTML = html;
}