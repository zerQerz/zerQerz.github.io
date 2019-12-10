// 产生随机数
if (!location.hash) {
    location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
}
// 获取房间号
const roomHash = location.hash.substring(1);

// ScaleDrone创建的channel，你也可以自己创建
const drone = new ScaleDrone('JztSpBPk9PVwgSMV');
// 房间名必须以'observable-'开头
const roomName = 'observable-' + roomHash;
const configuration = {
    iceServers: [{
        urls: 'stun:stun.l.google.com:19302'  // 使用谷歌的stun服务
    }]
};
let room;
let pc;


function onSuccess() {};

function onError(error) {
    console.error(error);
};

drone.on('open', error => {
    if (error) {
        return console.error(error);
    }
    room = drone.subscribe(roomName);
    room.on('open', error => {
        if (error) {
            onError(error);
        }
    });

    // 已经链接到房间后，就会收到一个members数组，代表房间里的成员
    // 这时候信令服务已经就绪
    room.on('members', members => {
        console.log('MEMBERS', members);
        // 如果你是第二个链接到房间的人，就会创建offer
        const isOfferer = members.length === 2;
        startWebRTC(isOfferer);
    });
});

// 通过Scaledrone发送信令消息
function sendMessage(message) {
    drone.publish({
        room: roomName,
        message
    });
}

var bol = false;
var video = document.getElementById('video');
var recordPlayer = document.getElementById('recordPlayer');
var recordBtn = document.getElementById('recordBtn');
var playBtn = document.getElementById('playBtn');
var downloadBtn = document.getElementById('downloadBtn');
var buffer;
var mediaStream;
var mediaRecoder;
var promise = null;
//var chunks = [];
//var mediaStream = null;
function startWebRTC(isOfferer) {
    pc = new RTCPeerConnection(configuration);

    // 当本地ICE Agent需要通过信号服务器发送消息到其他端时
    // 会触发icecandidate事件回调
    pc.onicecandidate = event => {
        if (event.candidate) {
            sendMessage({'candidate': event.candidate});
        }
    };

    // 如果用户是第二个进入的人，就在negotiationneeded 事件后创建sdp
    if (isOfferer) {
        // onnegotiationneeded 在要求session协商时发生
        pc.onnegotiationneeded = () => {
            // 创建本地sdp描述 SDP (Session Description Protocol) Session描述协议
            pc.createOffer().then(localDescCreated).catch(onError);
        }
    }

    // 当远程数据流到达时，将数据流装载到video中
    pc.ontrack = event => {
        const stream = event.streams[0];
        if (!video.srcObject || video.srcObject.id !== stream.id) {
            mediaStream = stream;
            video.srcObject = stream;
            video.play();
        }
    };

    // 获取本地媒体流
    navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
    }).then(stream => {
        // 将本地捕获的视频流装载到本地video中
        localVideo.srcObject = stream;
        // 将本地流加入RTCPeerConnection 实例中，发送到其他端
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }, onError);

    // 从Scaledrone监听信令数据
    room.on('data', (message, client) => {
        // 消息是我自己发送的，则不处理
        if (client.id === drone.clientId) {
            return;
        }

        if (message.sdp) {
            // 设置远程sdp，在offer 或者answer后
            pc.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
                // 当收到offer 后就接听
                if (pc.remoteDescription.type === 'offer') {
                    pc.createAnswer().then(localDescCreated).catch(onError);
                }
            }, onError);
        } else if (message.candidate) {
            // 增加新的 ICE canidatet 到本地的链接中
            pc.addIceCandidate(
                new RTCIceCandidate(message.candidate), onSuccess, onError
            );
        }
    });
}

function localDescCreated(desc) {
    pc.setLocalDescription(
        desc,
        () => sendMessage({'sdp': pc.localDescription}),
        onError
    );
}

function capture(){
    var canvas = document.getElementById("canvas");
    var context = canvas.getContext("2d");
    //绘制画面
    context.drawImage(video,0,0,480,360);
}
var filters = ['', 'grayscale', 'sepia', 'invert'];
var currentFilter = 0;
function changeFilter(){
    currentFilter++;
    if(currentFilter>filters.length-1) currentFilter=0;
    canvas.className = filters[currentFilter];
}

//录制按钮点击事件
recordBtn.onclick = function(){
    if(true){
        if (recordBtn.textContent==='开始录制') {
            startRecord();
            recordBtn.textContent='停止录制';
            playBtn.removeAttribute('disabled');
            downloadBtn.removeAttribute('disabled');
        }else if (recordBtn.textContent==='停止录制') {
            stopRecord();
            recordBtn.textContent='开始录制';
            //playBtn.setAttribute('disabled',true);
            //downloadBtn.setAttribute('disabled',true);
        }
    }else{alert("请打开摄像头！！！")}
}
//开始录制
function startRecord(){
    var options = {mimeType:'video/webm;codecs=vp8'};
    try{
        buffer = [];
        mediaRecoder = new MediaRecorder(mediaStream,options);
        console.log('获得了mediaRecoder!')
    }catch(e){
        console.log('创建MediaRecorder失败');
        return;
    }
    mediaRecoder.ondataavailable = function(e){
        if (e && e.data && e.data.size>0) {
            buffer.push(e.data);
        }
    }
    //开始录制，录制时间片为10ms
    mediaRecoder.start(10);
}
//停止录制
function stopRecord(){
    mediaRecoder.stop();
}
//播放按钮点击事件
playBtn.onclick = function(){
    var blob = new Blob(buffer,{type:'video/mp4'});
    //根据缓存数据生成url给recordPlayer进行播放
    recordPlayer.src = window.URL.createObjectURL(blob);
    recordPlayer.srcObject = null;
    recordPlayer.controls = true; //显示播放控件
}
//下载按钮点击事件
downloadBtn.onclick = function(){
    var blob = new Blob(buffer, {type:'video/mp4'});
    //根据缓存数据生成url
    var url = window.URL.createObjectURL(blob);
    //创建一个a标签，通过a标签指向url来下载
    var a = document.createElement('a');
    a.href = url;
    a.style.display = 'none'; //不显示a标签
    a.download = new Date().toLocaleTimeString();
    a.click(); //调用a标签的点击事件进行下载
}
// function startRecord() {
//         console.log('开始');
//         if (!mediaStream){
//             alert('请先开启摄像头');
//             return;
//         }
//         var recorder = new MediaRecorder(mediaStream);//获取MediaRecorder实例
//         console.log(recorder)
//         recorder.start();
//         recorder.ondataavailable = function(e) {//添加获取到录制数据事件监听
//             chunks.push(e.data);
//         }
//         recorder.onstop = function (e) {//录制结束
//             console.log(chunks)
//             var blob = new Blob(chunks,{type:'video/mp4'});
//             var videoUrl = URL.createObjectURL(blob);
//             document.getElementById('recorderVideo').src = videoUrl;

//             downloadBtn.href = videoUrl;
//             downloadBtn.download = new Date().toLocaleTimeString()

//         }
//         document.getElementById('stopRecord').onclick = function () {
//             recorder.stop();
//         }

//     }