import { WebSocketServer, WebSocket } from 'ws';
import { createClient } from 'redis';

const publishClient = createClient();
publishClient.connect();

const subscribeClient = createClient();
subscribeClient.connect();

const wss = new WebSocketServer({ port: 8080 });


const users: { [key: string]: {
    ws: WebSocket,
    rooms: string[]
} } = {

};


wss.on('connection', function connection(ws) {
    
    const id = randomId();
    users[id] = {
        ws: ws,
        rooms: []
    }

    ws.on('error', console.error);

    ws.on('message', function message(data) {
        const parsedMessage = JSON.parse(data as unknown as string);

        if(parsedMessage.type === 'SUBSCRIBE') {
            users[id].rooms.push(parsedMessage.room);
            if(oneUserSubscribedTo(parsedMessage.room)) {
                subscribeClient.subscribe(parsedMessage.room, (message) => {
                    const parsedMessage = JSON.parse(message);
                    Object.keys(users).forEach((userId) => {
                        const { ws, rooms } = users[userId];
                        if(rooms.includes(parsedMessage.room)) {
                            ws.send(JSON.stringify({
                                type: 'MESSAGE',
                                message: parsedMessage.message,
                                userId
                            }));
                        }
                    });
                });  
            }

        }

        if(parsedMessage.type === 'UNSUBSCRIBE') {
            users[id].rooms = users[id].rooms.filter((room) => room !== parsedMessage.room);
            if(lastPersonLeftRoom(parsedMessage.room)) {
                subscribeClient.unsubscribe(parsedMessage.room);
            }
        }

        if(parsedMessage.type === "SENDMESSAGE") {
            const message = parsedMessage.message;
            const roomId = parsedMessage.roomId;

            publishClient.publish(roomId, JSON.stringify({
                type: 'SENDMESSAGE',
                roomId: roomId,
                message
            }));
        }
    });

    ws.send('something');
});

function randomId() {
    return Math.random().toString();
}

function oneUserSubscribedTo(roomId: string) {
    let totalInterestedUsers = 0;
    Object.keys(users).forEach((userId) => {
        if(users[userId].rooms.includes(roomId)) {
            totalInterestedUsers++;
        }
    });

    if(totalInterestedUsers === 1) {
        return true;
    }

    return false;
}

function lastPersonLeftRoom(roomId: string) {
    let totalInterestedUsers = 0;
    Object.keys(users).forEach((userId) => {
        if(users[userId].rooms.includes(roomId)) {
            totalInterestedUsers++;
        }
    });

    if(totalInterestedUsers === 0) {
        return true;
    }

    return false;
}
