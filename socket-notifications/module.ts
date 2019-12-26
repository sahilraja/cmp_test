import { SocketNotifications, NotificationType } from "./model";
import { emitLatestNotificationCount } from "../socket";

export async function create(payload: any) {
    const createdNotification = await SocketNotifications.create(payload)
    emitLatestNotificationCount((createdNotification as any).userId)
    return createdNotification
}

export async function list(userId: string, currentPage = 1, limit = 30) {
    return {
        docs: [
            {
                createdAt:`2019-11-07 09:26:37.014Z`,
                _id:`5dff1e67fd85f009697fc696`,
                title: `Saikumar published new Document`,
                notificationType: NotificationType[NotificationType.DOCUMENT],
                userId: ``,
                taskId: null,
                messageId: null,
                documentId: `5dff1e67fd85f009697fc696`,
                read: false,
            },
            {
                createdAt:`2019-11-07 09:26:37.014Z`,
                _id:`5dff1e67fd85f009697fc696`,
                title: `Saikumar assigned new Task to you`,
                notificationType: NotificationType[NotificationType.TASK],
                userId: ``,
                taskId: `5dfdd1877be9b97f019198b1`,
                messageId: null,
                documentId: null,
                read: true,
            },
            {
                createdAt:`2019-11-07 09:26:37.014Z`,
                _id:`5dff1e67fd85f009697fc696`,
                title: `Saikumar sent you new message`,
                notificationType: NotificationType[NotificationType.MESSAGE],
                userId: ``,
                taskId: ``,
                messageId: `5e00cdb6efed126586b72d4c`,
                documentId: ``,
                read: false,
            }
        ], 
        page: 1, pages: 1
    }
    return await SocketNotifications.paginate({ userId }, { page: Number(currentPage), limit: Number(limit), sort:{createdAt:-1} })
}

export async function listUnreadNotifications(userId: string) {
    return await SocketNotifications.find({userId, read: false}).exec()
}

export async function markAsRead(id: string, userId: string) {
    const updatedNotification = await SocketNotifications.findByIdAndUpdate(id, { $set: { read: true } }).exec()
    emitLatestNotificationCount(userId)
    return updatedNotification
}