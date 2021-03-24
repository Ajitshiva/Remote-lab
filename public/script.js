const name = prompt("Enter your name");
const color = ['red', 'green', 'blue'];
let colorIndex = 0;
const colorMap = new Map();
let socket = io('/');
ace.require("ace/keybindings/sublime");
ace.require("ace/ext/language_tools");

const editor = ace.edit("editor");
const session = editor.getSession();
const doc = session.getDocument();
const selection = session.selection;
const AceRange = ace.require("ace/range").Range;
const aceRangeUtil = AceCollabExt.AceRangeUtil;
const customSelection = new AceCollabExt.AceMultiSelectionManager(session);
const customCursor = new AceCollabExt.AceMultiCursorManager(session);
const cursorColor = ["orange", "red", "green", "cyan", "blue"];
let cursorColorMap = new Map();
let cursorColorIndex = 0;
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

editor.on("change", () =>{
  socket.emit("code-save", editor.getValue());
})

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
    output.setValue("Compiling...");
    output.clearSelection();
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


selection.on("changeCursor", () => {
    const position = editor.getCursorPosition();
    selection.moveCursorTo(position.row, position.column, true);
    socket.emit("code-update", {
      type: "CURSOR_UPDATED",
      payload: {
        user: getUser(),
        cursor: position
      }
    });
  });

  selection.on("changeSelection", e => {
    const rangesJson = aceRangeUtil.toJson(editor.selection.getAllRanges());
    const ranges = aceRangeUtil.fromJson(rangesJson);
    let newRanges = [...ranges];
  
    newRanges.forEach((range, index) => {
      if (range.start.row === range.end.row && range.start.column === range.end.column) 
      {
        ranges.splice(index, 1);
      }
    });
  
    if (ranges.length > 0) {
      socket.emit("code-update", {
        type: "SELECTION_UPDATED",
        payload: {
          user: getUser(),
          ranges
        }
      });
    }
  });

editorUpdated({ state: true, callback: editorUpdatedCallback });

socket.on("code-update", data => {
    const { type, payload } = data;
  
    switch (type) {
      case "UPDATE_EDITOR":
        updateEditor({ ...payload });
        break;
      case "UPDATE_CURSOR":
        updateCursor({ ...payload });
        break;
      case "UPDATE_SELECTION":
        updateSelection({ ...payload });
        break;
      case "USER_DISCONNECTED":
        removeOtherUser({ ...payload });
        break;
      default:
        break;
    }
  });

function getUser() {
    return name;
}

function updateSelection({ user, ranges }) {
    if (user === getUser()) {
      return;
    }
  
    let newRanges = ranges.map(range => {
      return new AceRange(
        range.start.row,
        range.start.column,
        range.end.row,
        range.end.column
      );
    });
    
    
    if (!Boolean(customSelection._selections["user"+user])) {
      customSelection.addSelection("user"+user, user, cursorColorMap.get(user), []);
    }
    customSelection.setSelection("user"+user, newRanges);
  
  }

  function removeOtherUser({ user }) {
    if (user === getUser()) {
      return;
    }
    if (Boolean(customCursor._cursors["user"+user])) {
      customCursor.removeCursor("user"+user);
    }
  
    if (Boolean(customSelection._selections["user"+user])) {
      customSelection.removeSelection("user"+user);
    }
  }
  
  function editorUpdatedCallback(lines) {
    socket.emit("code-update", {
      type: "EDITOR_UPDATED",
      payload: {
        lines,
        cursor: editor.getCursorPosition(),
        user: getUser()
      }
    });
  }
  
  function editorUpdated({ state, callback }) {
    session.getDocument()[state ? "on" : "off"]("change", callback);
  }
  
  function updateEditor({ user, lines }) {
    if (user === getUser()) {
      return;
    }
    let code = editor.getValue();
    selection.clearSelection();

    if(code == "" && lines.action == "remove") return;
    
    editorUpdated({ state: false, callback: editorUpdatedCallback });
    doc.applyDeltas([lines]);
    editorUpdated({ state: true, callback: editorUpdatedCallback });
  }
  let localCursors;
  function updateCursor({ user, cursor }) {
    if (user === getUser()) {
      return;
    }
    localCursors = customCursor.valueOf();
    if(!Boolean(localCursors._cursors["user"+user]))
    {
      cursorColorMap.set(user, cursorColor[colorIndex]);
      customCursor.addCursor("user"+user, user, cursorColorMap.get(user), 0);
      cursorColorIndex = (cursorColorIndex + 1)%cursorColor.length;
  
    }
    if (!Boolean(customSelection._selections["user"+user])) {
        customSelection.addSelection("user"+user, user,cursorColorMap.get(user), []);
    }
    customCursor.setCursor("user"+user, cursor);
    if (Boolean(customSelection._selections["user"+user])) {
        customSelection.removeSelection("user"+user);
    }
  
    selection.clearSelection();

  }

const editorDiv = document.getElementById('editor');
const inputDiv = document.getElementById('input');
const outputDiv = document.getElementById('output');

editorDiv.addEventListener('keyup', event => {
    selection.clearSelection();
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
meetingId.textContent = ROOM_ID;


meetingId.addEventListener('click', ()=>{
    const meetingId = document.getElementById('meeting-id');
    var aux = document.createElement("input");
    aux.setAttribute("value", meetingId.innerText);
    document.body.appendChild(aux);
    aux.select();
    alert("Room ID copied")
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
    socket.emit('code-change', sampleCode[language.toLowerCase()], getUser());
    
    editor.session.setMode('ace/mode/' + mode.toLowerCase());
    socket.emit('language-change', language);

});

socket.on('more-users',() => {
    window.location.href = "/more-users";
})

socket.on('code-change', (code, user) => {
    editor.setValue("");
    editor.insert(code);
    selection.clearSelection();
    // customSelection.clearSelection();
    // if (Boolean(customSelection._selections["user"+user])) {
    //     customSelection.removeSelection("user"+user);
    //   }
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
    socket.emit("code-update", {
  
        type: "INIT_USER",
        payload: { cursor: editor.selection.getCursor(), user: getUser() }
      });
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
    var msgColor = "";
    if(colorMap.has(username)) msgColor = colorMap.get(username);
    else
    {
        msgColor = color[(colorIndex++)%color.length];
        colorMap.set(username,msgColor);

    }
    if(username !== name) $('ul').append(`<li class = "other-messages ${msgColor}"><b>${username}</b>${message}</li><div></div>`);
    else $('ul').append(`<li class = "messages ${msgColor} "><b class = "name">${username}</b>${message}</li><div><div/>`);

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

    const btn = `<i class = "fas fa-microphone"></i>`;
    var mute_btn = document.getElementById('mute__audio');
    mute_btn.innerHTML = btn;
}
const setUnmuteButton = () =>{
    const btn = `<i class = "unmute fas fa-microphone-slash"></i>`;
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
                   
                    `;
    document.getElementById('mute__video').innerHTML = html;
}
const setStopVideo = ()=>{
    const html =   `<i class = "fas fa-video"></i>
                  
                    `;
    document.getElementById('mute__video').innerHTML = html;
}

