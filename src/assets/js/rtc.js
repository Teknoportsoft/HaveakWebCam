
import h from './helpers.js';
const room = h.getQString(location.href, 'room');
const username = sessionStorage.getItem('username');
const rolu = sessionStorage.getItem('rolu');

var pc = [];
var users = [];

let socket = io('/stream');

var socketId = '';
var myStream = '';
var screen = '';
var recordedStream = [];
var mediaRecorder = '';

window.addEventListener('load', () => {

    if (!room) {
        document.querySelector('#room-create').attributes.removeNamedItem('hidden');
    }
    else if (!username) {
        
        var currentLocation = window.location.href.toString().split(window.location.host + '/?room=')[1];
        var roomname = currentLocation.split('_')[0];
        document.getElementById('roomnamex').value = roomname;
        document.querySelector('#username-set').attributes.removeNamedItem('hidden');
        document.getElementById('username').focus();
    }
    else {
        
        //let commElem = document.getElementsByClassName( 'room-comm' );

        //for ( let i = 0; i < commElem.length; i++ ) {
        //    commElem[i].attributes.removeNamedItem( 'hidden' );
        //}
        document.getElementById('kontroller').setAttribute("style", "visibility: visible;"); 
        document.getElementById('kullanici').innerHTML = username;

        setTimeout(function () {
            //let chatElem = document.querySelector('#chat-pane');
            let mainSecElem = document.querySelector('#main-section');
            //chatElem.attributes.removeNamedItem('hidden');
            //chatElem.classList.add('chat-opened'); 
            mainSecElem.classList.remove('col-md-12');
            mainSecElem.classList.add('col-md-9');

            //document.getElementById('toggle-mute').click();
            //document.getElementById('mute-image').setAttribute('class', 'fas fa-microphone-alt-slash');
        }, 500);

        //Get user video by default
        getAndSetUserStream();

       

        socket.on('connect', () => {            
            //set socketId         
            
            socketId = socket.io.engine.id;     

            socket.emit('subscribe', {
                room: room,
                socketId: socketId
                //usernames: username,
                //roluser: rolu
            });          


            socket.on('new user', (data) =>
            {                 
                socket.emit('newUserStart', { to: data.socketId, sender: socketId, usernames: username, roluser: rolu });
                pc.push(data.socketId);
                users.push({ sockedid: data.socketId, usernames: username, roluser: rolu });
                init(true, data.socketId);
            });


            socket.on('newUserStart', (data) => {                
                pc.push(data.sender);  
                users.push({ sockedid: data.sender , usernames: username, roluser: rolu });
                init(false, data.sender);
            });


            socket.on('ice candidates', async (data) => {
                data.candidate ? await pc[data.sender].addIceCandidate(new RTCIceCandidate(data.candidate)) : '';
            });


            socket.on('sdp', async (data) => {

                if (data.description.type === 'offer') {
                    data.description ? await pc[data.sender].setRemoteDescription(new RTCSessionDescription(data.description)) : '';

                    h.getUserFullMedia().then(async (stream) => {
                        if (!document.getElementById('local').srcObject) {
                            h.setLocalStream(stream);
                        }

                        //save my stream
                        myStream = stream;

                        stream.getTracks().forEach((track) => {
                            pc[data.sender].addTrack(track, stream);
                        });

                        let answer = await pc[data.sender].createAnswer();

                        await pc[data.sender].setLocalDescription(answer);

                        socket.emit('sdp', { description: pc[data.sender].localDescription, to: data.sender, sender: socketId });
                    }).catch((e) => {
                        console.error(e);
                    });
                }

                else if (data.description.type === 'answer') {
                    await pc[data.sender].setRemoteDescription(new RTCSessionDescription(data.description));
                }
            });


            socket.on('chat', (data) => {
                h.addChat(data, 'remote');
            });
        });

        //Chat textarea
        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.which === 13 && (e.target.value.trim())) {
                e.preventDefault();

                sendMsg(e.target.value);

                setTimeout(() => {
                    e.target.value = '';
                }, 50);
            }
        });


        //When the video icon is clicked
        document.getElementById('toggle-video').addEventListener('click', (e) => {
            e.preventDefault();

            let elem = document.getElementById('toggle-video');

            if (myStream.getVideoTracks()[0].enabled) {
                e.target.classList.remove('fa-video');
                e.target.classList.add('fa-video-slash');
                elem.setAttribute('title', 'Show Video');

                myStream.getVideoTracks()[0].enabled = false;
            }

            else {
                e.target.classList.remove('fa-video-slash');
                e.target.classList.add('fa-video');
                elem.setAttribute('title', 'Hide Video');

                myStream.getVideoTracks()[0].enabled = true;
            }

            broadcastNewTracks(myStream, 'video');
        });


        document.getElementById('mute-image').addEventListener('click', (e) => {
            e.preventDefault();
            let elem = document.getElementById('toggle-mute');

            if (myStream.getAudioTracks()[0].enabled) {
                e.target.classList.remove('fa-microphone-alt');
                e.target.classList.add('fa-microphone-alt-slash');
                elem.setAttribute('title', 'Unmute');

                myStream.getAudioTracks()[0].enabled = false;
            }

            else {
                e.target.classList.remove('fa-microphone-alt-slash');
                e.target.classList.add('fa-microphone-alt');
                elem.setAttribute('title', 'Mute');

                myStream.getAudioTracks()[0].enabled = true;
            }

            broadcastNewTracks(myStream, 'audio');
        });

        document.getElementById('share-screen').addEventListener('click', (e) => {
            e.preventDefault();

            if (screen && screen.getVideoTracks().length && screen.getVideoTracks()[0].readyState !== 'ended') {
                stopSharingScreen();
            }

            else {
                shareScreen();
            }
        });

        document.getElementById('record').addEventListener('click', (e) => {

            if (!mediaRecorder || mediaRecorder.state === 'inactive') {
                h.toggleModal('recording-options-modal', true);
            }

            else if (mediaRecorder.state === 'paused') {
                mediaRecorder.resume();
            }

            else if (mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
        });


        document.getElementById('record-screen').addEventListener('click', () => {
            h.toggleModal('recording-options-modal', false);

            if (screen && screen.getVideoTracks().length) {
                startRecording(screen);
            }

            else {
                h.shareScreen().then((screenStream) => {
                    startRecording(screenStream);
                }).catch(() => { });
            }
        });


        document.getElementById('record-video').addEventListener('click', () => {
            h.toggleModal('recording-options-modal', false);

            if (myStream && myStream.getTracks().length) {
                startRecording(myStream);
            }

            else {
                h.getUserFullMedia().then((videoStream) => {
                    startRecording(videoStream);
                }).catch(() => { });
            }
        });
    }
});


function getAndSetUserStream() {
    h.getUserFullMedia().then((stream) => {
        myStream = stream; h.setLocalStream(stream);
    }).catch((e) => {
        console.error(`stream error: ${e}`);
    });
}


function sendMsg(msg) {
    let data = {
        room: room,
        msg: msg,
        sender: username
    };
    socket.emit('chat', data);
    h.addChat(data, 'local');
}

function init(createOffer, partnerName) {    


    pc[partnerName] = new RTCPeerConnection(h.getIceServer());
   
    if (screen && screen.getTracks().length) {
        screen.getTracks().forEach((track) => {
            pc[partnerName].addTrack(track, screen);//should trigger negotiationneeded event
        });
    }
    else if (myStream) {
        myStream.getTracks().forEach((track) => {
            pc[partnerName].addTrack(track, myStream);//should trigger negotiationneeded event
        });
    }
    else {
        h.getUserFullMedia().then((stream) => {
            //save my stream
            myStream = stream;

            stream.getTracks().forEach((track) => {
                pc[partnerName].addTrack(track, stream);//should trigger negotiationneeded event
            });

            h.setLocalStream(stream);
        }).catch((e) => {
            console.error(`stream error: ${e}`);
        });
    }


    if (createOffer) {
        pc[partnerName].onnegotiationneeded = async () => {
            let offer = await pc[partnerName].createOffer();

            await pc[partnerName].setLocalDescription(offer);

            socket.emit('sdp', { description: pc[partnerName].localDescription, to: partnerName, sender: socketId });
        };
    }


    pc[partnerName].onicecandidate = ({ candidate }) => {
        socket.emit('ice candidates', { candidate: candidate, to: partnerName, sender: socketId });
    };


    pc[partnerName].ontrack = (e) => {

        let str = e.streams[0];
        if (document.getElementById(`${partnerName}-video`)) {
            document.getElementById(`${partnerName}-video`).srcObject = str;
        }

        else {            
            let userx = users.find(s => s.sockedid === partnerName).usernames;
            let rolx = users.find(s => s.sockedid === partnerName).roluser;

            //video elem
            let newVid = document.createElement('video');
            newVid.id = `${partnerName}-video`;
            newVid.srcObject = str;
            newVid.autoplay = true;
            newVid.className = 'remote-video';
            //newVid.title = usernamex;          
            

            //video controls elements
            let controlDiv = document.createElement('div');
            controlDiv.className = 'remote-video-controls';
            let kontrols = "";           
            if (rolx==="admin") {
                kontrols = `<i class="fa fa-microphone text-white pr-3 mute-remote-mic" title="Mute"></i><i class="fa fa-expand text-white expand-remote-video" title="Expand"></i>`;
            }
            else {
                kontrols = `<i class="fa fa-expand text-white expand-remote-video" title="Expand"></i>`;
            }
            controlDiv.innerHTML = kontrols;

            //create a new div for card
            let cardDiv = document.createElement('div');
            cardDiv.className = 'card card-sm';
            cardDiv.id = partnerName;
            cardDiv.appendChild(newVid);
            cardDiv.appendChild(controlDiv);
            cardDiv.style.marginLeft = "2px";
            cardDiv.style.border = "thick solid rgb(80 165 241)";

            let userdiv = document.createElement('span');
            userdiv.className = 'badge badge-pill badge-info';
            userdiv.innerHTML = (userx === undefined ? "Oda Kurucu" : userx);

            var x = document.createElement("INPUT");
            x.setAttribute("type", "hidden");
            x.setAttribute("name", "users[]");
            x.value = userx;

            var y = document.createElement("INPUT");
            y.setAttribute("type", "hidden");
            y.setAttribute("name", "rol[]");
            y.value = rolx;

            //put div in main-section elem
            document.getElementById('videos').appendChild(cardDiv);
            document.getElementById(cardDiv.id).appendChild(userdiv);
            document.getElementById(cardDiv.id).appendChild(x);
            document.getElementById(cardDiv.id).appendChild(y);

            h.adjustVideoElemSize();
        }
    };



    pc[partnerName].onconnectionstatechange = (d) => {
        switch (pc[partnerName].iceConnectionState) {
            case 'disconnected':
            case 'failed':
                h.closeVideo(partnerName);
                removeClientFromMap(username, partnerName);
                break;

            case 'closed':
                h.closeVideo(partnerName);
                removeClientFromMap(username, partnerName);
                break;
        }
    };



    pc[partnerName].onsignalingstatechange = (d) => {
        switch (pc[partnerName].signalingState) {
            case 'closed':
                console.log("Sinyal durumu 'kapalý'");
                h.closeVideo(partnerName);
                removeClientFromMap(username, partnerName);
                break;
        }
    };
}





function shareScreen() {
    h.shareScreen().then((stream) => {
        h.toggleShareIcons(true);
        //disable the video toggle btns while sharing screen. This is to ensure clicking on the btn does not interfere with the screen sharing
        //It will be enabled was user stopped sharing screen
        h.toggleVideoBtnDisabled(true);
        //save my screen stream
        screen = stream;

        //share the new stream with all partners
        broadcastNewTracks(stream, 'video', false);

        //When the stop sharing button shown by the browser is clicked
        screen.getVideoTracks()[0].addEventListener('ended', () => {
            stopSharingScreen();
        });
    }).catch((e) => {
        console.error(e);
    });
}



function stopSharingScreen() {
    //enable video toggle btn
    h.toggleVideoBtnDisabled(false);

    return new Promise((res, rej) => {
        screen.getTracks().length ? screen.getTracks().forEach(track => track.stop()) : '';

        res();
    }).then(() => {
        h.toggleShareIcons(false);
        broadcastNewTracks(myStream, 'video');
    }).catch((e) => {
        console.error(e);
    });
}



function broadcastNewTracks(stream, type, mirrorMode = true) {
    h.setLocalStream(stream, mirrorMode);

    let track = type === 'audio' ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];

    for (let p in pc) {
        let pName = pc[p];

        if (typeof pc[pName] === 'object') {
            h.replaceTrack(track, pc[pName]);
        }
    }
}


function toggleRecordingIcons(isRecording) {
    let e = document.getElementById('record');

    if (isRecording) {
        e.setAttribute('title', 'Stop recording');
        e.children[0].classList.add('text-danger');
        e.children[0].classList.remove('text-white');
    }

    else {
        e.setAttribute('title', 'Record');
        e.children[0].classList.add('text-white');
        e.children[0].classList.remove('text-danger');
    }
}


function startRecording(stream) {
    mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
    });

    mediaRecorder.start(1000);
    toggleRecordingIcons(true);

    mediaRecorder.ondataavailable = function (e) {
        recordedStream.push(e.data);
    };

    mediaRecorder.onstop = function () {
        toggleRecordingIcons(false);

        h.saveRecordedStream(recordedStream, username);

        setTimeout(() => {
            recordedStream = [];
        }, 3000);
    };

    mediaRecorder.onerror = function (e) {
        console.error(e);
    };
}
