
const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const {v4 : uuidv4} = require('uuid');
const {ExpressPeerServer} = require('peer');
const { send } = require('process');
const peerServer = ExpressPeerServer(server, {
    debug : true
});


let currentCode = "";
let currentLanguage = "Python";

app.set('view engine', 'ejs');
app.use('/peerjs', peerServer);
app.use(express.static('public'))
app.get('/', (req, res)=>{
    res.redirect(`/${uuidv4()}`);
})
app.get('/left', (req, res)=>{
    res.send("Thank you for using this app. Please visit again");
})
app.get('/:room', (req, res)=>{
    res.render('room', {roomId: req.params.room});
})

io.on('connection', socket => {
    
    socket.on('join-room', (roomId, userId, username)=>{
        socket.join(roomId);
        
        console.log(username + " connected.");
        socket.to(roomId).broadcast.emit("user-connected", userId);
        io.to(roomId).emit('joinMessage', username);
        socket.on('message', message => {
            io.to(roomId).emit('createMessage', username, message);
        })
        socket.to(roomId).emit('code-update', currentCode);
        socket.to(roomId).emit('language-change', currentLanguage);
    
        socket.on('code-update', code =>{
            currentCode = code;
            socket.to(roomId).broadcast.emit('code-update', code);
        })
        socket.on('language-change', language =>{
            currentLanguage = language;
            socket.to(roomId).broadcast.emit('language-change', language);
        })
        socket.on('disconnect', ()=>{
            console.log(username + " disconnected");
            io.to(roomId).emit('leftMessage', username);
            socket.to(roomId).broadcast.emit('user-disconnected', userId);
        })
    

        
    })
   
})
server.listen(process.env.PORT || 3030, () => console.log("Server is running on the port 3030"));
