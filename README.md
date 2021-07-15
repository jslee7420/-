# 졸업프로젝트

## **웹기반 인공지능 캠스터디 플랫폼 "Study With Us"**

Study With Us는 **참여자들의 모습을 웹캠으로 공유하며 진행하는 캠스터디 플랫폼**입니다. 기존의 캠스터디 플랫폼에 인공지능 관리 기능을 더해 보다 적극적인 관리와 함께 공부시간에 대한 객관적인 피드백을 제공합니다. 이 프로젝트는 코로나 19로 증가한 재택학습/재택근무자들이 겪는 집중력 및 자기통제력 하락 문제를 해결하기 위해 시작되었습니다. 현재 로컬에서만 작동하는 데모버전까지 구현에 성공했습니다.

## System Architecture
<p align="center"><img src="https://user-images.githubusercontent.com/46511190/125466565-d61b8cdc-c97c-4bfc-ba4d-3c175d1ce5e9.png"></p>

## 기술 스택

**Javascript(ES6), HTML5, CSS3, WebRTC, face-api.js**

## 주요 코드 설명

현재 다음과같은 핵심 기능들만을 포함하는 클라이언트 사이드 코드가 완성된 상태입니다.

1. p2p 영상전송(local에서 동작)
2. face detection 을 통한 자리비움 감지 기능
3. face landmarking을 통한 졸음 감지 기능
4. 채팅

서버 구현까지 하지 못하여 로컬환경에서만 동작하는 데모 어플리케이션 형태로 완성시켰고 로컬 영상을 전송해서 전송한 영상을 다시 로컬에서 재생하는 방식으로 작동합니다. 채팅 기능도 내가 상대방 peer로 전송한 데이터를 로컬에서 다시 받아 출력하는 형태로 구현하였습니다.

### 1. p2p 영상전송(local에서 동작)

사용자간의 웹캠 영상 공유를 위해 WebRTC API를 사용했습니다. WebRTC는 브라우저 간의 p2p 연결을 지원하는 API로 이를 통해 사용자간의 영상 전송이 가능합니다. 크게 두가지 기능을 지원하는데 media capture devices를 사용하여 웹캠 영상과 음성을 가져올 수 있고 p2p connectivity를 지원합니다.

**웹캠영상 스트림 받아오기**  
navigator.mediaDevices.getUserMedia()메소드를 활용하여 웹캠으로부터 브라우저로 영상을 받아오도록 구현했습니다.

```javascript
// Capture video stream using WebRTC API
async function playVideoFromCamera() {
  try {
    const constraints = {
      video: true,
      audio: true,
    };
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = localStream;
  } catch (error) {
    console.error("Error opening video camera.", error);
  }
}
```

**p2p connection 생성 및 설정과 채팅**
RTCPeerConnection는 두 피어간의 데이터 통신을 관장하는 객체로 이 객체를 통하여 영상과 텍스트 데이터를 주고받습니다. ICE(Internet connectivity Establishment) framework를 사용하여 상대방 peer의 네트워크 인터페이스와 포트를 찾게되고 icecandidate event handler를 지정하여 remote peer를 찾았을때의 동작을 명시합니다. 미디어 정보의 교환을 위한 Signaling은 Session Description Protocol (SDP)를 사용하는 offer와 answer를 통해서 진행됩니다. localPeerConnection 객체가 dataChannel을 생성하고 이 데이터 채널을 통해 채팅 문자열을 전송하게 됩니다.

```javascript
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
```

### 2. face detection 을 통한 자리비움 감지 기능

자리비움 탐지를 위하여 face detection 모델을 사용했습니다. 브라우저에서 모델을 사용할 수 있도록 하기 위해 javascript로 작성된 face-api.js을 사용했습니다. face-api.js는 브라우저에서 face detection과 face recognition 을 위해 작성된 javascript API입니다.

face-api.js에서 제공하는 여러 face detection 모델들이 있는데 그중 크기가 작아 real-time detection이 가능한 Tiny Face Detector 모델을 사용하였습니다. setInterval 함수로 0.2초마다 face detection을 수행하고 탐지가 3초 이상(실제 서비스에서는 10초 이상으로 변경하여야 합니다.) 인 경우 자리비움으로 간주하도록 했습니다.

```javascript
setInterval(async () => {
  const useTinyModel = true;
  // Detect Facial Landmarks
  const detectionsWithLandmarks = await faceapi
    .detectAllFaces(
      video,
      new faceapi.TinyFaceDetectorOptions({
        scoreThreshold: 0.3,
      })
    )
    .withFaceLandmarks(useTinyModel);

  if (detectionsWithLandmarks.length == 0) {
    noFaceEndTime = Date.now();
    faceDetection.innerHTML = "얼굴 없음";
    eyeblinkDetection.innerHTML = "";
  } else {
    unoccupiedFlag = false;
    faceDetection.innerHTML = "얼굴 감지";
    noFaceStartTime = Date.now();
  }
  if (noFaceEndTime - noFaceStartTime > 3000) {
    detectionState.innerHTML = "자리비움";
    unoccupiedFlag = true;
  } else {
    detectionState.innerHTML = "";
  }
}, 200);
```

### 3. face landmarking을 통한 졸음 감지 기능

face-api.js에서는 face landmark을 그려 face recognition과 face expression recognition을 가능하게 해줍니다. face landmark에서 left eye와 right eye 객체만을 뽑아내 eye blink detecitond을 구현하였습니다.

**EAR(Eye Aspect Ratio)**

eye blink detection을 위해 2016년에 나온 Soukupová and Čech 의 논문 “Real-Time Eye Blink Detection using Facial Landmarks”을 참고하였습니다. face landmark에서는 다음 사진과 같이 눈의 형태를 6개의 landmark로 표현합니다.
<p align="center"><img src="https://user-images.githubusercontent.com/46511190/125466630-90a95b5e-41eb-445b-8a4d-dab37485fea6.png"></p>
<p align="center">The 6 facial landmarks associated with the eye.</p>


이렇게 얻어진 6개점의 좌표값을 EAR(Eye Aspect Ratio)에 넣어주면 눈감김 여부를 탐지할 수 있습니다. EAR에서 분자값은 eye landmark의 수직 거리를 계산하고 분모에서는 수평 거리를 계산하게 됩니다. 수직거리를 두번 더하기 때문에 분모에 2를 곱함으로써 가중치를 준 식입니다.

**The eye aspect ratio equation**
<p align="center"><img src="https://user-images.githubusercontent.com/46511190/125466648-2d369784-50dc-4b1b-bd8c-f0da81d6e312.png"></p>
<p align="center">Top-left: A visualization of eye landmarks when then the eye is open. Top-right: Eye landmarks when the eye is closed. Bottom: Plotting the eye aspect ratio over time. The dip in the eye aspect ratio indicates a blink</p>


위 그래프에서 볼 수 있듯이 눈이 떠져있는 상태에서는 눈 크기의 변화가 있음에도 EAR값의 변화가 완만하여 상수값에 가깝습니다. 하지만 눈이 감기는 순간에는 EAR이 급격히 0에 가까워짐을 볼 수 있습니다. 이렇게 EAR값이 0에 가까워지는 순간 눈감김이 일어났음을 알 수 있습니다.

**EAR 계산을 통한 졸음 감지**

face-api.js의 detectFaceLandmark 메소드로 face landmark를 얻어서 왼쪽과 오른쪽눈의 landmark를 따로 객체로 생성했습니다. 이후 양쪽눈 각각에 대해 euclideanDistance를 구하여 EAR을 계산하여 두눈의 EAR 값의 평균을 구하였고 scaling을 하여 임계값 이하로 떨어지는 EAR값이 계산될때를 눈감김으로 인식하고도록 구현했습니다. 자리비움 감지와 마찬가지로 눈감김이 일정시간이상 지속되는 경우 졸음으로 판단합니다.

```javascript
const detectionsWithLandmarks = await faceapi.detectAllFaces(video, new         // EAR calculation
        if(!unoccupiedFlag){    // detect drowsiness when occupied
            const landmarks = await faceapi.detectFaceLandmarks(video);
            const leftEye = landmarks.getLeftEye();
            const rightEye = landmarks.getRightEye();
            // EAR(Eye Aspect Ratio calculation)
            const leftEyeEAR = (faceapi.euclideanDistance([leftEye[1]._x, leftEye[1]._y], [leftEye[5]._x, leftEye[5]._y]) + faceapi.euclideanDistance([leftEye[2]._x, leftEye[2]._y], [leftEye[4]._x, leftEye[4]._y])) / (2 * faceapi.euclideanDistance([leftEye[0]._x, leftEye[0]._y], [leftEye[3]._x, leftEye[3]._y]));
            const rightEyeEAR = (faceapi.euclideanDistance([rightEye[1]._x, rightEye[1]._y], [rightEye[5]._x, rightEye[5]._y]) + faceapi.euclideanDistance([rightEye[2]._x, rightEye[2]._y], [rightEye[4]._x, rightEye[4]._y])) / (2 * faceapi.euclideanDistance([rightEye[0]._x, rightEye[0]._y], [rightEye[3]._x, rightEye[3]._y]));
            const avgEAR = ((leftEyeEAR + rightEyeEAR) / 2.0) * 500
            if (avgEAR < 150){ // Eye closed
                eyeblinkDetection.innerHTML = 'Eyes closed';
                closedEyesStartTime = Date.now();
            }else{ // Eye opened
                eyeblinkDetection.innerHTML = 'Eyes opened';
                openedEyesStartTime = Date.now();
            }
            if (closedEyesStartTime - openedEyesStartTime > 2000) {
                detectionState.innerHTML = '졸음감지';
                drowsinessFlag = true;
            } else {
                detectionState.innerHTML = '';
            }
        }
        else{ // no drowsiness detection when unoccupied
            drowsinessFlag = false;
        }
```

## 결과

### 1. Study With Us Demo 시연 화면
<p align="center"><img src="https://user-images.githubusercontent.com/46511190/125466673-38bfadaf-0b77-472a-9413-42241958bb4b.png"></p>
웹캠 화면이 정상적으로 브라우저에 보이는 것을 확인 할 수 있습니다. 시그널링 서버 구현을 하지 못해 로컬 환경에서 p2p로 영상을 보내고 받도록 구현했습니다. Local Video가 사용자 본인의 화면을 나타내고 Remote Video는 전송보낸 영상이 출력됩니다. face detection과 face landmark가 작동함을 보이기 위해 영상에 object box와 landmark contour를 그려주었습니다.

### 2. 자리비움 감지
<p align="center"><img src="https://user-images.githubusercontent.com/46511190/125466680-7ba82048-6d00-4bb3-ba15-a34d2d16214d.png"></p>
자리를 비우면 자리비움을 감지하여 자리비움 문구와 함께 자리비움 시간 카운트가 실행됩니다.

### 3. 졸음 감지
<p align="center"><img src="https://user-images.githubusercontent.com/46511190/125466689-0cffb22a-5963-4ff1-b68d-818cf2f31a16.png"></p>
눈을 일정 시간 이상 감고 있는 경우 졸음이 감지 됩니다. 하지만 face-api.js가 제공하는 face landmark 모델의 eye landmark 탐지 성능이 좋지 않아 부정확한 동작을 보였습니다.

### 4. 채팅
<p align="center"><img src="https://user-images.githubusercontent.com/46511190/125466693-6b2580cf-425e-45a0-ba79-ee51ec0693d2.png"></p>
<p align="center"><img src="https://user-images.githubusercontent.com/46511190/125466703-da713d8b-8061-4e01-a16a-78ff335eda6c.png"></p>
채팅 기능도 정상 작동함을 볼 수 있습니다. 채팅의 경우 RTCPeerConnection으로 생성한 Data channel을 통해 상대방 피어로 전송됩니다.

## References

https://www.pyimagesearch.com/2017/04/24/eye-blink-detection-opencv-python-dlib/
https://webrtc.org/
https://justadudewhohacks.github.io/face-api.js/docs/index.html  
Tereza Soukupova and Jan ´ Cech. Real-Time Eye Blink Detection using Facial Landmarks. 21st Computer Vision Winter Workshop
Luka Cehovin, Rok Mandeljc, Vitomir ˇ Struc (eds.) ˇ
Rimske Toplice, Slovenia, February 3–5, 2016
