// Define DOM elements
let video = document.querySelector("#videoInput");
let canvasOutput = document.querySelector("#canvasOutput");
let videoOut = document.querySelector("#videoOutput");
let remoteVideo = document.querySelector("#remoteVideo");

// Define peer connections, streams
let localPeerConnection;
let remotePeerConnection;

let localStream;
let remoteStream;

// Set up to exchange only video.
const offerOptions = {
    offerToReceiveVideo: 1,
};

// Capture canvas stream
let canvasStream = canvasOutput.captureStream();
console.log('Got stream from canvas');
videoOut.srcObject = canvasStream;

// Capture video stream using WebRTC API
async function playVideoFromCamera() {
    try {
        const constraints = {
            'video': true,
            'audio': true
        };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = localStream;
    } catch (error) {
        console.error('Error opening video camera.', error);
    }
}
playVideoFromCamera();

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

// Call action
async function call() {
    console.log("Starting call.");

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

    // Create peer connections and add behavior.
    localPeerConnection = new RTCPeerConnection(servers);
    console.log('Created local peer connection object localPeerConnection.')

    localPeerConnection.addEventListener('icecandidate', handleConnection);
    localPeerConnection.addEventListener('iceconnectionstatechange', handleConnectionChange);

    remotePeerConnection = new RTCPeerConnection(servers);
    console.log('Created remote peer connection object remotePeerConnection.');

    remotePeerConnection.addEventListener('icecandidate', handleConnection);
    remotePeerConnection.addEventListener('iceconnectionstatechange', handleConnectionChange);
    remotePeerConnection.addEventListener('addstream', gotRemoteMediaStream);

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




// Video processing using OpenCV.js
// This has to be called after OpenCV gets loaded, checks if opencv has initialized
cv['onRuntimeInitialized'] = () => {
    console.log("OpenCV loaded successfully!");
    document.querySelector('#status').innerHTML = 'OpenCV.js is ready.';

    let src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
    let dst = new cv.Mat(video.height, video.width, cv.CV_8UC4);
    let gray = new cv.Mat();
    let cap = new cv.VideoCapture(video);
    let faces = new cv.RectVector();
    let eyes = new cv.RectVector();
    let roiGray = null;

    let faceClassifier = new cv.CascadeClassifier();
    let eyeClassifier = new cv.CascadeClassifier();
    let streaming = false;
    let utils = new Utils('errorMessage');


    // load pre-trained classifiers
    let faceCascadeFile = 'haarcascade_frontalface_default.xml'; // path to xml
    let eyeCascadFile = 'haarcascade_eye.xml' // path to xml
    utils.createFileFromUrl(faceCascadeFile, faceCascadeFile, () => {
        faceClassifier.load(faceCascadeFile); // in the callback, load the cascade from file 
    });
    utils.createFileFromUrl(eyeCascadFile, eyeCascadFile, () => {
        eyeClassifier.load(eyeCascadFile); // in the callback, load the cascade from file 
    });

    const FPS = 60;

    function processVideo() {
        try {
            if (!streaming) {
                // clean and stop.
                src.delete();
                dst.delete();
                gray.delete();
                faces.delete();
                faceClassifier.delete();
                eyeClassifier.delete();
                roiGray.delete();
                roiSrc.delete();
                return;
            }
            let begin = Date.now();
            // start processing.
            cap.read(src);
            src.copyTo(dst);
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

            // detect faces.
            try {
                faceClassifier.detectMultiScale(gray, faces, 1.1, 3, 0);
                console.log(faces.size());
            } catch (err) {
                console.log(err);
            }

            // draw faces.
            for (let i = 0; i < faces.size(); ++i) {
                roiGray = gray.roi(faces.get(i));
                roiSrc = dst.roi(faces.get(i));
                let face = faces.get(i);
                let point1 = new cv.Point(face.x, face.y);
                let point2 = new cv.Point(face.x + face.width, face.y + face.height);
                cv.rectangle(dst, point1, point2, [255, 0, 0, 255]);

                // detect eyes in face ROI
                eyeClassifier.detectMultiScale(roiGray, eyes);
                for (let j = 0; j < eyes.size(); ++j) {
                    let point1 = new cv.Point(eyes.get(j).x, eyes.get(j).y);
                    let point2 = new cv.Point(eyes.get(j).x + eyes.get(j).width,
                        eyes.get(j).y + eyes.get(j).height);
                    cv.rectangle(roiSrc, point1, point2, [0, 0, 255, 255]);
                }
            }


            cv.imshow('canvasOutput', dst);
            // schedule the next one.
            let delay = 1000 / FPS - (Date.now() - begin);
            setTimeout(processVideo, delay);
        } catch (err) {
            console.log("processVideo error", err);
        }
    }

    //schedule first one.
    video.onplay = (event) => {
        console.log("video start");
        streaming = true;
        processVideo();
        call();
    };
}


// Define helper functions.

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