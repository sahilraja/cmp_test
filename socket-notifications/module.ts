import { SocketNotifications, NotificationType } from "./model";
import { emitLatestNotificationCount, emitLatestInboxCount } from "../socket";
import { userFindMany, getTasksByIds, groupPatternMatch } from "../utils/users";
import { getFullNameAndMobile } from "../users/module";
import { replaceAll } from "../patterns/module";
import { Types } from "mongoose";

export async function create(payload: any) {
    const createdNotification = await SocketNotifications.create(payload)
    emitLatestNotificationCount((createdNotification as any).userId)
    emitLatestInboxCount((createdNotification as any).userId)
    return createdNotification
}

export async function list(userId: string, currentPage = 1, limit = 30, token: string) {
    let { docs: notifications, page, limit: pageLimit, pages } = await SocketNotifications.paginate({ userId }, { page: Number(currentPage), limit: Number(limit), sort: { createdAt: -1 }, populate: "docId" })
    let [userObjs, taskObjs, groupObjs] = await Promise.all([
        userFindMany("_id", [... new Set((notifications.reduce((main, curr: any) => main.concat(curr.from, curr.userId), []).filter(id => Types.ObjectId(id))))]),
        getTasksByIds([... new Set((notifications.map(({ taskId }: any) => taskId)).filter(id => Types.ObjectId(id)))], token),
        groupPatternMatch({ "_id": [... new Set((notifications.map(({ groupId }: any) => groupId)).filter(id => Types.ObjectId(id)))] })
    ])
    return { docs: await Promise.all(notifications.map((notificationObj: any) => formatNotification(notificationObj.toJSON(), { users: userObjs, tasks: taskObjs, groups: groupObjs }))), page, limit: pageLimit, pages }
}

async function formatNotification(notificationObj: any, details: any) {
    let userKeys = ["from", "userId"];
    let keys = (notificationObj.title.match(/\[(.*?)\]/g))
    keys = keys && keys.length? keys.map((key: string) => key.substring(1, key.length - 1)) : []
    let replaceAllObj = keys.map((key: string) => {
        if (userKeys.includes(key)) return { key: key, match: (getFullNameAndMobile(details.users.find((userObj: any) => notificationObj[key] == userObj._id)) || { fullName: "" }).fullName }
        if (key == "taskId") return { key: key, match: details.tasks.find((taskObj: any) => notificationObj[key] == taskObj._id || { name: "" }).name }
        if (key == "docId") return { key: key, match: notificationObj.docId.name }
        if (key == "groupId") return { key: key, match: details.groups.find((groupObj: any) => notificationObj[key] == groupObj._id || { name: "" }).name }
        else return { key: [key], match: "" }
    })
    for (const { key, match } of replaceAllObj) {
        notificationObj.title = replaceAll(notificationObj.title, `[${key}]`, match)
    }
    return { ...notificationObj, docId: notificationObj.docId ? notificationObj.docId._id : notificationObj.docId }
}

export async function listUnreadNotifications(userId: string) {
    return await SocketNotifications.find({ userId, read: false }).exec()
}

export async function markAsRead(id: string, userId: string) {
    const updatedNotification = await SocketNotifications.findByIdAndUpdate(id, { $set: { read: true } }).exec()
    emitLatestNotificationCount(userId)
    return updatedNotification
}