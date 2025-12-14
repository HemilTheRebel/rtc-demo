const {
  randomBytes,
} = require('node:crypto');

const { Server } = require("socket.io");
const { createServer } = require('node:http');

const express = require('express')
const app = express()
app.use(express.static('public'))
app.use(express.json())

const server = createServer(app);
const io = new Server(server);

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('answer', (msg) => {
    console.log(`answer received: ${JSON.stringify(msg)}`);
    io.emit('answer', msg);
  }); 

  socket.on('calleeCandidates', (msg) => {
    console.log(`calleeCandidates received: ${JSON.stringify(msg)}`);
    io.emit('calleeCandidates', msg);
  }); 

  socket.on('callerCandidates', (msg) => {
    console.log(`callerCandidates received: ${JSON.stringify(msg)}`);
    io.emit('callerCandidates', msg);
  }); 

  socket.on('urlChange', (msg) => {
    console.log(`urlChange received: ${JSON.stringify(msg)}`);
    io.emit('urlChange', msg);
  }); 

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

const rooms = new Map();
console.log(`rooms top level: ${JSON.stringify(rooms)}`);

app.post('/room', (req, res) => {
  const buf = randomBytes(3);
  const id = buf.toString('hex');
  // const id = "123456";

  console.log(`id: ${id}, type: ${typeof(id)}`);
  console.log(`body: ${JSON.stringify(req.body)}, type: ${typeof(req.body)}`);
  rooms.set(id, req.body);
  console.log(`rooms: ${JSON.stringify(rooms)}`);

  res.json({id});
})

app.get('/room/:id', (req, res) => {
  console.log(`rooms: ${JSON.stringify(rooms)}`);
  const id = req.params.id;
  console.log(`id: ${id}, type: ${typeof(id)}`);
  res.json({data: rooms.get(id)});
})

const port = 3000
server.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})