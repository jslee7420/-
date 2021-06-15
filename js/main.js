// Define DOM elements
let video = document.querySelector("#videoInput");
let canvasOutput = document.querySelector("#canvasOutput");
let remoteVideo = document.querySelector("#remoteVideo");
let detectionState = document.querySelector("#detectionState");
let faceDetection = document.querySelector("#faceDetection");
let eyeblinkDetection = document.querySelector("#eyeblinkDetection");

let sendChannel;
let receiveChannel;
let dataChannelSend = document.querySelector('textarea#dataChannelSend');
let dataChannelReceive = document.querySelector('textarea#dataChannelReceive');
let sendButton = document.querySelector('button#sendButton');
let unoccupiedTimeElement = document.querySelector('#unoccupiedTime');
let drowsinessTimeElement =  document.querySelector('#drowsinessTime');

const videoSize = { width: video.width, height: video.height };

// Define peer connections, streams
let localPeerConnection;
let remotePeerConnection;

let localStream;
let remoteStream;

let noFaceStartTime;
let noFaceEndTime;
let closedEyesStartTime;
let openedEyesStartTime;

let startTime;
let currentTime;
let timeDiff
let timer = document.querySelector('#timer');
let unoccupiedTime = 0;
let unoccupiedFlag = false;
let drowsinessTime = 0;
let drowsinessFlag = false;

// loading the models
Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models'),
    // faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
]).then(playVideoFromCamera)

////////////////////////////////////////
// Time Count
startTime = Date.now();
setInterval(timeCounter, 1000);

function timeConvert(time){
    let hour = time.getHours() - 9; // UTC 보다 9시간 빠름(대한민국 기준)
    let minute = time.getMinutes();
    let second = time.getSeconds();
    if (hour < 10) {
        hour = '0' + hour.toString();
    }
    if (minute < 10) {
        minute = '0' + minute.toString();
    }
    if (second < 10) {
        second = '0' + second.toString();
    }
    return {hh:hour, mm:minute, ss:second};
}

function timeCounter() {
    // Time counter
    currentTime = Date.now();
    timeDiff = new Date(currentTime - startTime);
    let timeCounter = time=timeConvert(timeDiff)
    timer.innerHTML = timeCounter.hh + ':' + timeCounter.mm + ':' + timeCounter.ss;

    // Unoccupied time counter
    if (unoccupiedFlag) {
        unoccupiedTime += 1000;
        let timeStack = new Date(unoccupiedTime);
        let unoccupiedTimeCounter = timeConvert(timeStack);
        unoccupiedTimeElement.innerHTML = unoccupiedTimeCounter.hh + ':' + unoccupiedTimeCounter.mm + ':' + unoccupiedTimeCounter.ss;
    }

    // Drowsiness time counter
    if (drowsinessFlag) {
        drowsinessTime += 1000;
        let timeStack = new Date(drowsinessTime);
        let drowsinessTimeCounter = timeConvert(timeStack);
        drowsinessTimeElement.innerHTML = drowsinessTimeCounter.hh + ':' + drowsinessTimeCounter.mm + ':' + drowsinessTimeCounter.ss;
    }
}


//////////////////////////////////////

// Set up to exchange only video.
const offerOptions = {
    offerToReceiveVideo: 1,
};

// Capture canvas stream
let canvasStream = canvasOutput.captureStream();
console.log('Got stream from canvas');

// Capture video stream using WebRTC API
async function playVideoFromCamera() {
    try {
        const constraints = {
            'video': true,
            'audio': false
        };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = localStream;
    } catch (error) {
        console.error('Error opening video camera.', error);
    }
}
// playVideoFromCamera();

// Handles remote MediaStream success by adding it as the remoteVideo src.
function gotRemoteMediaStream(event) {
    const mediaStream = event.stream;
    remoteVideo.srcObject = mediaStream;
    remoteStream = mediaStream;
    console.log('Remote peer connection received remote stream.');
}

// Define RTC peer connection behavior

// Connect with new peer candidate
async function handleConnection(event) {
    const peerConnection = event.target;
    const iceCandidate = event.candidate;

    if (iceCandidate) {
        const newIceCandidate = new RTCIceCandidate(iceCandidate);
        const otherPeer = getOtherPeer(peerConnection);

        try {
            await otherPeer.addIceCandidate(newIceCandidate);
            console.log(`${getPeerName(peerConnection)} addIceCandidate success.`);
        } catch (err) {
            console.log(`${getPeerName(peerConnection)} failed to add ICE Candidate:\n` +
                `${error.toString()}.`);
        }

        console.log(`${getPeerName(peerConnection)} ICE candidate:\n` + `${event.candidate.candidate}.`);
    }
}



// Logs changes to the connection state.
function handleConnectionChange(event) {
    const peerConnection = event.target;
    console.log('ICE state change event: ', event);
    console.log(`${getPeerName(peerConnection)} ICE state: ` +
        `${peerConnection.iceConnectionState}.`);
}


// Logs error when setting session description fails.
function setSessionDescriptionError(error) {
    console.log(`Failed to create session description: ${error.toString()}.`);
}

// Logs success when setting session description.
function setDescriptionSuccess(peerConnection, functionName) {
    const peerName = getPeerName(peerConnection);
    console.log(`${peerName} ${functionName} complete.`);
}

// Logs success when localDescription is set.
function setLocalDescriptionSuccess(peerConnection) {
    setDescriptionSuccess(peerConnection, 'setLocalDescription');
}

// Logs success when remoteDescription is set.
function setRemoteDescriptionSuccess(peerConnection) {
    setDescriptionSuccess(peerConnection, 'setRemoteDescription');
}


// Logs offer creation and sets peer connection session descriptions.
async function createdOffer(description) {
    console.log(`Offer from localPeerConnection:\n${description.sdp}`);

    try {
        console.log('localPeerConnection setLocalDescription start.');
        await localPeerConnection.setLocalDescription(description);
        setLocalDescriptionSuccess(localPeerConnection);
    } catch (err) {
        setSessionDescriptionError;
    }

    try {
        console.log('remotePeerConnection setRemoteDescription start.');
        await remotePeerConnection.setRemoteDescription(description);
        setRemoteDescriptionSuccess(remotePeerConnection);
    } catch (err) {
        setSessionDescriptionError;
    }

    try {
        console.log('remotePeerConnection createAnswer start.');
        const description2 = await remotePeerConnection.createAnswer();
        await createdAnswer(description2);
    } catch (err) {
        setSessionDescriptionError;
    }
}


// Logs answer to offer creation and sets peer connection session descriptions.
async function createdAnswer(description) {
    console.log(`Answer from remotePeerConnection:\n${description.sdp}.`);

    try {
        console.log('remotePeerConnection setLocalDescription start.');
        await remotePeerConnection.setLocalDescription(description);
        setLocalDescriptionSuccess(remotePeerConnection);
    } catch (err) {
        setSessionDescriptionError;
    }

    try {
        console.log('localPeerConnection setRemoteDescription start.');
        await localPeerConnection.setRemoteDescription(description);
        setRemoteDescriptionSuccess(localPeerConnection);
    } catch (err) {
        setSessionDescriptionError;
    }
}

/////////////////////////////////////
// Chat functions

function onSendChannelStateChange() {
    let readyState = sendChannel.readyState;
    console.log('Send channel state is: ' + readyState);
    if (readyState === 'open') {
        dataChannelSend.disabled = false;
        dataChannelSend.focus();
        sendButton.disabled = false;
    } else {
        dataChannelSend.disabled = true;
        sendButton.disabled = true;
    }
}


function receiveChannelCallback(event) {
    console.log('Receive Channel Callback');
    receiveChannel = event.channel;
    receiveChannel.onmessage = (event) => {
        console.log('Received Message');
        dataChannelReceive.value += (event.data + '\n');
        dataChannelReceive.scrollTop = dataChannelReceive.scrollHeight;
    };
    receiveChannel.onopen = onReceiveChannelStateChange;
    receiveChannel.onclose = onReceiveChannelStateChange;
}


function onReceiveChannelStateChange() {
    console.log('Receive channel state is: ' + receiveChannel.readyState);
}

function sendData() {
    let data = dataChannelSend.value;
    data = 'user1: ' + data;
    sendChannel.send(data);
    console.log('Sent Data: ' + data);
    setTimeout(() => dataChannelSend.value = '', 10);
}


dataChannelSend.onkeypress = () => {
    let key = window.event.keyCode;
    if (key === 13) {
        sendData();
    }
}
dataChannelReceive.disabled = true;

////////////////////////////////////////////////////////////
// Call action
async function call() {
    console.log("Starting call.");
    dataChannelSend.placeholder = '';
    sendButton.onclick = sendData;



    // Get local media stream tracks
    const videoTracks = canvasStream.getVideoTracks();
    const audioTracks = canvasStream.getAudioTracks();
    if (videoTracks.length > 0) {
        console.log(`Using video device: ${videoTracks[0].label}.`);
    }
    if (audioTracks.length > 0) {
        console.log(`Using audio device: ${audioTracks[0].label}.`);
    }

    const servers = null; // Allows for RTC server config.

    // Create local peer connections and add behavior.
    localPeerConnection = new RTCPeerConnection(servers);
    console.log('Created local peer connection object localPeerConnection.')

    localPeerConnection.addEventListener('icecandidate', handleConnection);
    localPeerConnection.addEventListener('iceconnectionstatechange', handleConnectionChange);

    // Create data send channel and add behavior
    sendChannel = localPeerConnection.createDataChannel('sendDataChannel', null);
    console.log('Created send data channel');
    sendChannel.onopen = onSendChannelStateChange;
    sendChannel.onclose = onSendChannelStateChange;



    // Create remote peer connections and add behavior
    remotePeerConnection = new RTCPeerConnection(servers);
    console.log('Created remote peer connection object remotePeerConnection.');

    remotePeerConnection.addEventListener('icecandidate', handleConnection);
    remotePeerConnection.addEventListener('iceconnectionstatechange', handleConnectionChange);
    remotePeerConnection.addEventListener('addstream', gotRemoteMediaStream);

    // Add data receive behavior
    remotePeerConnection.ondatachannel = receiveChannelCallback;

    // Add local stream to connection and create offer to connect.
    localPeerConnection.addStream(canvasStream);
    console.log('Added local stream to localPeerConncetion.');

    try {
        console.log('localPeerConnection createOffer start.');
        const description = await localPeerConnection.createOffer(offerOptions);
        await createdOffer(description);
    } catch (err) {
        console.log('Error while create offer', err);
    }
}



video.onplay = () => {
    //rezize canvasOutput
    faceapi.matchDimensions(canvasOutput, videoSize);

    // Deep learning model application
    setInterval(async () => {
        const useTinyModel = true;
        /* Display face landmarks */
        // Inoptinons size at which image is processed, the smaller the faster,
        // but less precise in detecting smaller faces, must be divisible
        // by 32, common sizes are 128, 160, 224, 320, 416, 512, 608,
        // for face tracking via webcam I would recommend using smaller sizes,
        // e.g. 128, 160, for detecting smaller faces use larger sizes, e.g. 512, 608
        // default: 416
        // minimum confidence threshold
        // default: 0.5

        // Detect Facial Landmarks
        const detectionsWithLandmarks = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({
            scoreThreshold: 0.3
        })).withFaceLandmarks(useTinyModel);

        if (detectionsWithLandmarks.length == 0) {
            noFaceEndTime = Date.now()
            faceDetection.innerHTML = '얼굴 없음';
            eyeblinkDetection.innerHTML = '';
        } else {
            unoccupiedFlag = false;
            faceDetection.innerHTML = '얼굴 감지';
            noFaceStartTime = Date.now();
        }
        if (noFaceEndTime - noFaceStartTime > 3000) {
            detectionState.innerHTML = '자리비움';
            unoccupiedFlag = true;
        } else {
            detectionState.innerHTML = '';
        }
        
        // EAR calculation
        if(!unoccupiedFlag){    // detect drowsiness when occupied
            const landmarks = await faceapi.detectFaceLandmarks(video);
            const leftEye = landmarks.getLeftEye();
            const rightEye = landmarks.getRightEye();
            // EAR(Eye Aspect Ratio calculation)
            const leftEyeEAR = (faceapi.euclideanDistance([leftEye[1]._x, leftEye[1]._y], [leftEye[5]._x, leftEye[5]._y]) + faceapi.euclideanDistance([leftEye[2]._x, leftEye[2]._y], [leftEye[4]._x, leftEye[4]._y])) / (2 * faceapi.euclideanDistance([leftEye[0]._x, leftEye[0]._y], [leftEye[3]._x, leftEye[3]._y]));
            const rightEyeEAR = (faceapi.euclideanDistance([rightEye[1]._x, rightEye[1]._y], [rightEye[5]._x, rightEye[5]._y]) + faceapi.euclideanDistance([rightEye[2]._x, rightEye[2]._y], [rightEye[4]._x, rightEye[4]._y])) / (2 * faceapi.euclideanDistance([rightEye[0]._x, rightEye[0]._y], [rightEye[3]._x, rightEye[3]._y]));
            const avgEAR = ((leftEyeEAR + rightEyeEAR) / 2.0) * 500
            if (avgEAR < 230){ // Eye closed
                eyeblinkDetection.innerHTML = 'Eyes closed';
                closedEyesStartTime = Date.now();
            }else{ // Eye opened
                eyeblinkDetection.innerHTML = 'Eyes opened';
                drowsinessFlag = false;
                openedEyesStartTime = Date.now();
            }
            if (closedEyesStartTime - openedEyesStartTime > 2000) {
                detectionState.innerHTML = '졸음감지';
                drowsinessFlag = true;
            } else {
                detectionState.innerHTML = '';
            }
        }else{ // no drowsiness detection when unoccupied
            drowsinessFlag = false;
        }
        
        // detect faces.
        // resize the detected boxes and landmarks in case your displayed image has a different size than the original
        const resizedResults = faceapi.resizeResults(detectionsWithLandmarks, videoSize);
        // Rendering
        let ctx = canvasOutput.getContext('2d');
        ctx.clearRect(0, 0, canvasOutput.width, canvasOutput.height) //앞에 그린 것 지우기
        ctx.drawImage(video, 0, 0, videoSize.width, videoSize.height);
        // draw detections into the canvas
        faceapi.draw.drawDetections(canvasOutput, resizedResults);
        // draw the landmarks into the canvas
        faceapi.draw.drawFaceLandmarks(canvasOutput, resizedResults);
    }, 200);
    call();
}

// // Define helper functions.

// Gets the "other" peer connection.
function getOtherPeer(peerConnection) {
    return (peerConnection === localPeerConnection) ?
        remotePeerConnection : localPeerConnection;
}

// Gets the name of a certain peer connection.
function getPeerName(peerConnection) {
    return (peerConnection === localPeerConnection) ?
        'localPeerConnection' : 'remotePeerConnection';
}