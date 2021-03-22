let express = require('express');
let app = express();
let server = require('http').Server(app);
let io = require('socket.io')(server);
let stream = require('./ws/stream');
let path = require('path');
let favicon = require('serve-favicon');

app.use(favicon(path.join(__dirname, 'favicon.ico')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/eski', (req, res) => {
    res.sendFile(__dirname + '/index_eski.html');
});

app.get('/sinif', (req, res) => {
    res.sendFile(__dirname + '/sinif.html');
});

io.of('/stream').on('connection', stream);



server.listen(3000);
