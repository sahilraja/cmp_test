import { jwt_Verify } from "./utils/utils";
import { AUTHENTICATE_MSG } from "./utils/error_msg";
import { userFindOne } from "./utils/users";
import { APIError } from "./utils/custom-error";
import { listUnreadNotifications } from "./socket-notifications/module";

const socketIO = require('socket.io')
let io: any = null
export function initializeSocket(http: any) {
    io = socketIO(http)
    io.sockets.on('connection', async(socket: any) => {
        socket.on('subscribe', async(data: any) => {
            let user = await verify(data);
            if(!user){
                socket.emit('subscribe', 'User not found');
            } else {
                socket.join(user._id);
            }
        })
        // socket.on('send message', async (data: any) => {
        // })
        socket.on('disconnect', async(data: any) => {
            let user = await verify(data)
            if(!user){
                socket.emit('subscribe', 'User not found');
            } else {
                socket.leave(user._id)
            }

        })
    })
}

async function verify(data: any) {
    data = JSON.parse(data);
    if(!(data.access_token)){
        throw new Error('User is required');
    }
    let token: any = await jwt_Verify(data.access_token)
    if (!token) throw new Error(AUTHENTICATE_MSG.INVALID_TOKEN)
    const user: any = await userFindOne("id", token.id);
    if (!user) {
        throw new APIError(AUTHENTICATE_MSG.INVALID_LOGIN, 401);
    }
    if (!user.is_active) {
        throw new APIError(AUTHENTICATE_MSG.USER_INACTIVE, 401);
    }
    return user
}

export async function emitLatestNotificationCount(userId: string) {
    if(!io) return;
    const unreadNotifications = await listUnreadNotifications(userId)
    io.to(userId).emit(`notificationCount`, unreadNotifications.length)
}