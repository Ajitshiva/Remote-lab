
const express = require('express');
const app = express();
const axios = require('axios');
const server = require('http').Server(app);
const io = require('socket.io')(server);
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
app.set('view engine', 'ejs');
app.use('/peerjs', peerServer);
app.use(express.static('public'))
app.get('/', (req, res)=>{
    res.redirect(`/${uuidv4()}`);
})
app.get('/left', (req, res)=>{
    res.send("Thank you for using this app. Please visit again");
})
app.get('/compile', (req, res)=>{
    const stmt = {
        clientId: "977785f5398e546e3d5f4060e34807da",
        clientSecret:"e90c69b841610cc183b8a2057c56bdfbf881313d676b0d1e958155ab4c28c76",
        script : req.query.script ,
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
        socket.join(roomId);
        noOfUsers++;
        console.log(username + " connected.");
        socket.to(roomId).broadcast.emit("user-connected", userId);
        io.to(roomId).emit('joinMessage', username, noOfUsers);
        socket.on('message', message => {
            io.to(roomId).emit('createMessage', username, message);
        })
        socket.to(roomId).emit('code-update', currentCode);
        socket.to(roomId).emit('language-change', currentLanguage);
    
        socket.on('code-update', code =>{
            currentCode = code;
            socket.to(roomId).broadcast.emit('code-update', code);
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
            noOfUsers--;
            console.log(username + " disconnected");
            io.to(roomId).emit('leftMessage', username, noOfUsers);
            socket.to(roomId).broadcast.emit('user-disconnected', userId);
        })
    

        
    })
   
})
server.listen(process.env.PORT || 3030, () => console.log("Server is running on the port 3030"));
