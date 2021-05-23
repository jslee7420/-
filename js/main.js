let video = document.querySelector("#videoInput");
let canvasOutput = document.querySelector("#canvasOutput");

//video stream using WebRTC API
navigator.mediaDevices.getUserMedia({
        video: true,
    }).then(function (stream) {
        video.srcObject = stream;
    })
    .catch(function (err) {
        console.log("local video streaming error!");
    });


//This has to be called after OpenCV gets loaded, checks if opencv has initialized
cv['onRuntimeInitialized'] = () => {
    console.log("OpenCV loaded successfully!");
    document.querySelector('#status').innerHTML = 'OpenCV.js is ready.';

    let src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
    let dst = new cv.Mat(video.height, video.width, cv.CV_8UC4);
    let gray = new cv.Mat();
    let cap = new cv.VideoCapture(video);
    let faces = new cv.RectVector();
    let eyes = new cv.RectVector();
    let roiGray =null;

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
    };
}