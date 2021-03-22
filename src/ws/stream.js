const stream = (socket) => {
      

    socket.on('subscribe', (data) => {       
        //subscribe/join a room
        
        socket.join(data.room);
        socket.join(data.socketId);
        socket.join(data.usernames);
        socket.join(data.roluser);

        //Inform other members in the room of new user's arrival
        if (socket.adapter.rooms[data.room].length > 1) {
            socket.to(data.room).emit('new user', { socketId: data.socketId });            
        }
    });

    socket.on( 'newUserStart', ( data ) => {
        socket.to(data.socketId).emit('newUserStart', { sender: data.sender });        
    });


    socket.on('sdp', ( data ) => {
        socket.to(data.socketId ).emit('sdp', { description: data.description, sender: data.sender } );
    } );


    socket.on( 'ice candidates', ( data ) => {
        socket.to(data.socketId ).emit('ice candidates', { candidate: data.candidate, sender: data.sender } );
    } );


    socket.on( 'chat', ( data ) => {
        socket.to( data.room ).emit('chat', { sender: data.sender, msg: data.msg } );
    }); 

};

module.exports = stream;
