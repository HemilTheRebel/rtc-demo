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
});

const rooms = new Map();

app.post('/room', (req, res) => {
  const buf = randomBytes(3);
  const id = buf.toString('hex');
  rooms.set(id, req.body);

  res.json({id});
})

app.get('/room/:id', (req, res) => {
  res.json({data: rooms.get(req.params.id)});
})

const port = 3000
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
