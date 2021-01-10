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

const input = ace.edit("input");
input.session.setMode("ace/mode/text");
input.setTheme("ace/theme/monokai");
input.setFontSize(16);
input.setShowPrintMargin(false);
input.setKeyboardHandler("ace/keyboard/sublime");

const output = ace.edit("output");
output.session.setMode("ace/mode/text");
output.setTheme("ace/theme/monokai");
output.setFontSize(16);
output.setShowPrintMargin(false);
output.setKeyboardHandler("ace/keyboard/sublime");

editor.setOptions({
    enableBasicAutocompletion: true,
    enableLiveAutocompletion: true
});

const sampleCode = {
    "c": "#include <stdio.h>\n\nint main() {\n\t// your code goes here\n\tprintf(\"Hello world\");\n\treturn 0;\n}\n\n",
    "c++":"#include <iostream>\nusing namespace std;\n\nint main() {\n\t// your code goes here\n\tcout << \"Hello World\";\n\treturn 0;\n}\n",
    "java":"import java.util.*;\nimport java.lang.*;\nimport java.io.*;\n\npublic class RemoteLab\n{\n\tpublic static void main (String[] args) throws java.lang.Exception\n\t{\n\t\t// your code goes here\n\t\tSystem.out.println(\"Hello world\");\n\t}\n}\n",
    "javascript":"console.log(\"hello world\");",
    "python":"import sys\nprint(\"hello world\")"   
}
editor.setValue(sampleCode["python"]);
editor.clearSelection();

let run = document.getElementById('run');
run.addEventListener('click', ()=>{
    let editor = ace.edit("editor");
    let output = ace.edit("output");
    let input = ace.edit("input");
    let languageSelect = document.getElementById('language-select');
    var language = languageSelect.value.toLowerCase();
    var version = "3";
    if(language == 'c' || language == 'c++') language = "cpp17", version = "0";
    if(language == 'python') language = "python3";
    if(language == 'javascript') language = "nodejs";
    axios.get('/compile', {
        params: {
            script: editor.getValue(),
            stdin: input.getValue(),
            language: language,
            versionIndex: version
        }
    })
        .then(function (response) {
            output.setValue(response.data.output);
            output.clearSelection();
            const code = output.getValue();
            socket.emit('output-update', code);
        })
        .catch(function (error) {
            output.setValue(error.data.output);
            output.clearSelection();
            const code = output.getValue();
            socket.emit('output-update', code);
        })
        .then(function () {
        });
})

const editorDiv = document.getElementById('editor');
const inputDiv = document.getElementById('input');
const outputDiv = document.getElementById('output');

editorDiv.addEventListener('keyup', event => {
    const code = editor.getValue();
    socket.emit('code-update', code);
});
inputDiv.addEventListener('keyup', event => {
    const code = input.getValue();
    socket.emit('input-update', code);
});


const chatHeader = document.querySelector('.main__header');
chatHeader.addEventListener('click', ()=>{
let chatBody = document.getElementById('chat');
chatBody.classList.toggle("open");
});

const meetingId = document.getElementById('meeting-id');
meetingId.textContent = "Room Id: " + ROOM_ID;
console.log("<%=roomId%>");


meetingId.addEventListener('click', ()=>{
    const meetingId = document.getElementById('meeting-id');
    var aux = document.createElement("input");
    aux.setAttribute("value", document.getElementById(meetingId).innerHTML);
    document.body.appendChild(aux);
    aux.select();
    document.execCommand("copy");
    document.body.removeChild(aux);
})
const languageSelect = document.getElementById('language-select');
languageSelect.addEventListener('change', event => {
    var language = languageSelect.value;
    var mode = language;
    if(language === 'C' || language === 'C++')  mode = "c_cpp";
    editor.setValue(sampleCode[language.toLowerCase()]);
    editor.clearSelection();
    socket.emit('code-update', sampleCode[language.toLowerCase()]);
    
    editor.session.setMode('ace/mode/' + mode.toLowerCase());
    socket.emit('language-change', language);

});
socket.on('code-update', code => {
    editor.setValue(code)
    editor.clearSelection();
});
socket.on('input-update', code => {
    input.setValue(code)
    input.clearSelection();
});
socket.on('output-update', code => {
    output.setValue(code)
    output.clearSelection();
});

socket.on('language-change',language => {
    languageSelect.value = language;
    var mode = language;
    if(language === 'C' || language === 'C++')  mode = "c_cpp";
    editor.session.setMode('ace/mode/' + mode.toLowerCase());
});

var peer = new Peer(undefined, {
    path: '/peerjs',
    host: '/',
    port: '443'
    // port: '3030'
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
        socket.emit('message', text.val());
        text.val('');
    }
})

socket.on('joinMessage', (username, noOfUsers) =>{
    document.getElementById('no-of-users').textContent = noOfUsers;
    $('ul').append(`<li class = "join-message"><b>${username}</b> joined the room</li>`);
    scrollToBottom();
})
socket.on('createMessage', (username, message) =>{
    $('ul').append(`<li class = "message"><b>${username}</b><br/>${message}</li>`);
    scrollToBottom();
})
socket.on('leftMessage', (username, noOfUsers) =>{
    document.getElementById('no-of-users').textContent = noOfUsers;
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
}
const setUnmuteButton = () =>{
    const btn = `<i class = "unmute fas fa-microphone-slash"></i><span>Unmute</span>`;
    var mute_btn = document.getElementById('mute__audio');
    mute_btn.innerHTML = btn;
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