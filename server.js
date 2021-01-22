
const express = require('express');
const app = express();
const axios = require('axios');
const server = require('http').Server(app);
const io = require('socket.io')(server, { wsEngine: 'ws' });
const {v4 : uuidv4} = require('uuid');
const {ExpressPeerServer} = require('peer');
const peerServer = ExpressPeerServer(server, {
    debug : true
});


let currentCode = "";
let currentInput = "";
let currentOutput = "";
let currentLanguage = "Python";
let noOfUsers = 0;
const users = {};
const cursors = {};
const roomCount = new Map();


app.set('view engine', 'ejs');
app.use('/peerjs', peerServer);
app.use(express.static("node_modules/ace-builds"));
app.use(express.static('public'))
app.use(express.static("node_modules/@convergence/ace-collab-ext"));
app.get('/', (req, res)=>{
    res.redirect(`/${uuidv4()}`);
})
app.get('/left', (req, res)=>{
    res.send("Thank you for using this app. Please visit again");
})
app.get('/more-users', (req, res)=>{
    res.send("Room is full");
  })
app.get('/compile', (req, res)=>{
    const stmt = {
        clientId: "977785f5398e546e3d5f4060e34807da",
        clientSecret:"e90c69b841610cc183b8a2057c56bdfbf881313d676b0d1e958155ab4c28c76",
        script : req.query.script,
        stdin: req.query.stdin,
        language: req.query.language,
        versionIndex: req.query.versionIndex,
        
    };
    axios.post('https://api.jdoodle.com/v1/execute', stmt)
        .then(function (response) {
            res.send(response.data);
        })
        .catch(function (error) {
            res.send(error.data)
        })

})

app.get('/:room', (req, res)=>{
    res.render('room', {roomId: req.params.room});
})

io.on('connection', socket => {
    
    socket.on('join-room', (roomId, userId, username)=>{
        if(!roomCount.has(roomId)) roomCount.set(roomId, 1);
        else roomCount.set(roomId, roomCount.get(roomId)+1);
        if(roomCount.get(roomId) > 2) 
        {
            roomCount.set(roomId, roomCount.get(roomId)-1);
            socket.emit("more-users");
            socket.to(roomId).disconnect();
        }
        else if(roomCount.size > 2)
        {
            socket.emit("more-users");
            roomCount.delete(roomId);
            socket.to(roomId).disconnect();
        }
        else
        {
            noOfUsers++;
            socket.join(roomId);
            console.log(username + " connected.");
            socket.to(roomId).broadcast.emit("user-connected", userId);
            io.to(roomId).emit('joinMessage', username, noOfUsers);
            socket.on('message', message => {
                io.to(roomId).emit('createMessage', username, message);
            })
            // socket.to(roomId).emit('code-change', currentCode);
            socket.to(roomId).emit('language-change', currentLanguage);
            socket.on("code-save", (code) =>{
                currentCode = code;
              });
            socket.on("code-update", data => {
                const { type, payload } = data;
                switch (type) {
                  case "INIT_USER":
                    io.to(roomId).emit("new-user-joined");
                    initUser({ socket, users, payload, cursors });
                    socket.to(roomId).broadcast.emit("code-update", username, currentCode);
                    updateAllCursors({ cursors, users, user: payload.user }, roomId);
                    break;
                  case "EDITOR_UPDATED":
                    updateCursor({ ...payload }, roomId);
                    io.to(roomId).emit("code-update", {
                      type: "UPDATE_EDITOR",
                      payload
                    });
                    break;
                  case "CURSOR_UPDATED":
                    updateCursor({ ...payload }, roomId);
                    break;
                  case "SELECTION_UPDATED":
                    io.to(roomId).emit("code-update", {
                      type: "UPDATE_SELECTION",
                      payload
                    });
                    break;
                }
              });
            socket.on('code-change', (code, user) =>{
                currentCode = code;
                socket.to(roomId).broadcast.emit('code-change', code, user);
            })
            socket.on('input-update', input =>{
                currentInput = input;
                socket.to(roomId).broadcast.emit('input-update', input);
            })
            socket.on('output-update', output =>{
                currentOutput = output;
                socket.to(roomId).broadcast.emit('output-update', output);
            })
            socket.on('language-change', language =>{
                currentLanguage = language;
                socket.to(roomId).broadcast.emit('language-change', language);
            })
            socket.on('disconnect', ()=>{
                const newUsers = { ...users };
              noOfUsers--;
              if(roomCount.get(roomId) == 1)
              {
                roomCount.delete(roomId);
              }
              else{
                roomCount.set(roomId, roomCount.get(roomId)-1);
              }
              Object.keys(newUsers).forEach(user => {
              if (newUsers[user] === socket) {
                  delete users[user];
                  
                  io.to(roomId).emit("code-update", {
                  type: "USER_DISCONNECTED",
                  payload: { user }
                  });
              }
              });
              console.log(username + " disconnected");
              io.to(roomId).emit('leftMessage', username, noOfUsers);
              socket.to(roomId).broadcast.emit('user-disconnected', userId);
          })
        }
    

        
    })
   
})
function initUser({ socket, users, payload: { user, cursor }, cursors }) {
    users[user] = socket;
    cursors[user] = cursor;
}

function updateCursor({ cursor, user }, roomId) {
  io.to(roomId).emit("code-update", {
    type: "UPDATE_CURSOR",
    payload: { user, cursor }
  });
}

function updateAllCursors({ cursors, users, user }, roomId) {
  let newUsers;
  let otherUser;

  updateCursor({
    cursor: cursors[user],
    user
  }, roomId);
}
server.listen(process.env.PORT || 3030, () => console.log("Server is running on the port 3030"));
