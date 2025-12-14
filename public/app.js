mdc.ripple.MDCRipple.attachTo(document.querySelector('.mdc-button'));

// DEfault configuration - Change these if you have a different STUN or TURN server.
const configuration = {
  iceServers: [
    {
      urls: [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};

let peerConnection = null;
let localStream = null;
let remoteStream = null;
let roomDialog = null;
let roomId = null;

const socket = io();

function init() {
  document.querySelector('#cameraBtn').addEventListener('click', openUserMedia);
  document.querySelector('#hangupBtn').addEventListener('click', hangUp);
  document.querySelector('#createBtn').addEventListener('click', createRoom);
  document.querySelector('#joinBtn').addEventListener('click', joinRoom);
  document.querySelector('#urlSubmit').addEventListener('click', changeUrl);

  roomDialog = new mdc.dialog.MDCDialog(document.querySelector('#room-dialog'));

  const viewer = document.getElementById('viewer');

  socket.on('urlChange', (msg) => {
    viewer.src = msg.src;
  })
}

function changeUrl() {
  const url = document.getElementById('url').value.trim();
  try {
    new URL(url);
  } catch (e) {
    console.error(e);
    return;
  }
  
  socket.emit('urlChange', {src: url});
}

async function createRoom() {
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;

  console.log('Create PeerConnection with configuration: ', configuration);
  peerConnection = new RTCPeerConnection(configuration);

  registerPeerConnectionListeners();

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // Code for collecting ICE candidates below
  peerConnection.addEventListener('icecandidate', event => {
    if (!event.candidate) {
      console.log('Got final candidate!');
      return;
    }
    console.log('Got candidate: ', event.candidate);
    socket.emit('callerCandidates', event.candidate.toJSON());
  });
  // Code for collecting ICE candidates above

  // Code for creating a room below
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  const room = { offer: { type: offer.type, sdp: offer.sdp } };

  const resp = await fetch('/room', { 
    method: 'POST', 
    body: JSON.stringify(room),
    headers: { 'Content-Type': 'application/json' },
  });
  if (resp.status == 200) {
    const json = await resp.json();
    document.querySelector('#currentRoom').innerText = `Current room is ${json.id} - You are the caller!`;
  }
  // Code for creating a room above

  peerConnection.addEventListener('track', event => {
    console.log('Got remote track:', event.streams[0]);
    event.streams[0].getTracks().forEach(track => {
      console.log('Add a track to the remoteStream:', track);
      remoteStream.addTrack(track);
    });
  });

  // Listening for remote session description below
  socket.on('answer', async (msg) => {
    if (!peerConnection.currentRemoteDescription && msg) {
      console.log('answer: ', msg);
      const answer = new RTCSessionDescription(msg);
      console.log('Set remote description: ', answer);
      await peerConnection.setRemoteDescription(answer);
    }
  });
  // Listening for remote session description above

  // Listen for remote ICE candidates below
  socket.on('calleeCandidates', async (msg) => {
    console.log(`Got new remote ICE candidate: ${JSON.stringify(msg)}`);
    await peerConnection.addIceCandidate(new RTCIceCandidate(msg));
  });
  // Listen for remote ICE candidates above

  document.getElementById('console').style.display = 'flex';
}

function joinRoom() {
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;

  document.querySelector('#confirmJoinBtn').
      addEventListener('click', async () => {
        roomId = document.querySelector('#room-id').value;
        console.log('Join room: ', roomId);
        document.querySelector(
            '#currentRoom').innerText = `Current room is ${roomId} - You are the callee!`;
        await joinRoomById(roomId);
      }, {once: true});
  roomDialog.open();
}

async function joinRoomById(roomId) {
  const resp = await fetch(`/room/${roomId}`);
  const json = await resp.json();

  if (!json.data) {
    console.error('room id not found');
  }
  
  console.log('Create PeerConnection with configuration: ', configuration);
  peerConnection = new RTCPeerConnection(configuration);
  registerPeerConnectionListeners();
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

    // Code for collecting ICE candidates below
    peerConnection.addEventListener('icecandidate', event => {
      if (!event.candidate) {
        console.log('Got final candidate!');
        return;
      }
      console.log('Got callee candidate: ', event.candidate);
      socket.emit('calleeCandidates', event.candidate.toJSON());
    });

    // Code for collecting ICE candidates above

    peerConnection.addEventListener('track', event => {
      console.log('Got remote track:', event.streams[0]);
      event.streams[0].getTracks().forEach(track => {
        console.log('Add a track to the remoteStream:', track);
        remoteStream.addTrack(track);
      });
    });

    // Code for creating SDP answer below
    const offer = json.data.offer;
    console.log('Got offer:', offer);
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    console.log('Created answer:', answer);
    await peerConnection.setLocalDescription(answer);

    const roomWithAnswer = { type: answer.type, sdp: answer.sdp }
    socket.emit('answer', roomWithAnswer);

    // Code for creating SDP answer above

    // Listening for remote ICE candidates below
    socket.on('callerCandidates', async (msg) => {
      console.log(`Got new remote ICE candidate: ${JSON.stringify(msg)}`);
          await peerConnection.addIceCandidate(new RTCIceCandidate(msg));
    });
    // Listening for remote ICE candidates above
}

async function openUserMedia(e) {
  const stream = await navigator.mediaDevices.getUserMedia(
      {video: true, audio: true});
  document.querySelector('#localVideo').srcObject = stream;
  localStream = stream;
  remoteStream = new MediaStream();
  document.querySelector('#remoteVideo').srcObject = remoteStream;

  console.log('Stream:', document.querySelector('#localVideo').srcObject);
  document.querySelector('#cameraBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = false;
  document.querySelector('#createBtn').disabled = false;
  document.querySelector('#hangupBtn').disabled = false;
}

async function hangUp(e) {
  const tracks = document.querySelector('#localVideo').srcObject.getTracks();
  tracks.forEach(track => {
    track.stop();
  });

  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
  }

  if (peerConnection) {
    peerConnection.close();
  }

  document.querySelector('#localVideo').srcObject = null;
  document.querySelector('#remoteVideo').srcObject = null;
  document.querySelector('#cameraBtn').disabled = false;
  document.querySelector('#joinBtn').disabled = true;
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#hangupBtn').disabled = true;
  document.querySelector('#currentRoom').innerText = '';

  document.location.reload(true);
}

function registerPeerConnectionListeners() {
  peerConnection.addEventListener('icegatheringstatechange', () => {
    console.log(
        `ICE gathering state changed: ${peerConnection.iceGatheringState}`);
  });

  peerConnection.addEventListener('connectionstatechange', () => {
    console.log(`Connection state change: ${peerConnection.connectionState}`);
  });

  peerConnection.addEventListener('signalingstatechange', () => {
    console.log(`Signaling state change: ${peerConnection.signalingState}`);
  });

  peerConnection.addEventListener('iceconnectionstatechange ', () => {
    console.log(
        `ICE connection state change: ${peerConnection.iceConnectionState}`);
  });
}

init();