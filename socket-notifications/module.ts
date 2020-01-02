import { SocketNotifications, NotificationType } from "./model";
import { emitLatestNotificationCount } from "../socket";
import { userFindMany, getTasksByIds } from "../utils/users";
import { getFullNameAndMobile } from "../users/module";
import { replaceAll } from "../patterns/module";

export async function create(payload: any) {
    const createdNotification = await SocketNotifications.create(payload)
    emitLatestNotificationCount((createdNotification as any).userId)
    return createdNotification
}

export async function list(userId: string, currentPage = 1, limit = 30, token: string) {
    let { docs: notifications, page, limit: pageLimit } = await SocketNotifications.paginate({ userId }, { page: Number(currentPage), limit: Number(limit), sort: { createdAt: -1 } })
    let [userObjs, taskObjs] = await Promise.all([
        userFindMany("_id", [... new Set(notifications.reduce((main, curr: any) => main.concat(curr.from, curr.userId), []))]),
        getTasksByIds([... new Set(notifications.map(({ taskId }: any) => taskId))], token)
    ])
    return { docs: await Promise.all(notifications.map((notificationObj: any) => formatNotification(notificationObj.toJSON(), { users: userObjs, tasks: taskObjs }))), page, limit: pageLimit }
}

async function formatNotification(notificationObj: any, details: any) {
    let userKeys = ["from", "userId"];
    let keys = (notificationObj.title.match(/\[(.*?)\]/g)).map((key: string) => key.substring(1, key.length - 1))
    let replaceAllObj = keys.map((key: string) => {
        if (userKeys.includes(key)) return { key: key, match: (getFullNameAndMobile(details.users.find((userObj: any) => notificationObj[key] == userObj._id)) || { fullName: "" }).fullName }
        if (key == "taskId") return { key: key, match: details.tasks.map((taskObj: any) => notificationObj[key] == taskObj._id || { name: "" }).name }
        else return { key: [key], match: "" }
    })
    for (const { key, match } of replaceAllObj) {
        notificationObj.title = replaceAll(notificationObj.title, `[${key}]`, match)
    }
    return notificationObj
}

export async function listUnreadNotifications(userId: string) {
    return await SocketNotifications.find({ userId, read: false }).exec()
}

export async function markAsRead(id: string, userId: string) {
    const updatedNotification = await SocketNotifications.findByIdAndUpdate(id, { $set: { read: true } }).exec()
    emitLatestNotificationCount(userId)
    return updatedNotification
}