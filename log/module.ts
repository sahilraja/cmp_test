import { ActivitySchema } from "./model";
import { userFindMany, getTasksByIds } from "../utils/users";

export async function create(payload: any) {
    return await ActivitySchema.create(payload)
}

export async function list(query = {}) {
    return await ActivitySchema.find(query).exec()
}

export async function detail(id: string) {
    return await ActivitySchema.findById(id).exec()
}

export async function edit(id: string, updates: any) {
    return await ActivitySchema.findByIdAndUpdate(id, { $set: updates }, { new: true }).exec()
}

export async function paginatedList(query = {}, page=1, limit=20) {
    return await ActivitySchema.paginate(query, {page, limit})
}

export async function getTaskLogs(taskId: string, token: string) {
    const activities = await ActivitySchema.find({taskId}).exec()
    const userIds = activities.reduce((p:any, activity: any) => 
    [...p, ...
        ((activity.addedUserIds || []).concat(activity.removedUserIds || []).concat([activity.activityBy]))
    ], []).filter((v: string) => v)
    const subTaskIds = activities.map((activity: any) => activity.subTask).filter(v => !!v)
    const [usersInfo, subTasks] = await Promise.all([
        userFindMany('_id', userIds, {firstName:1, lastName:1, middleName:1, email:1, phoneNumber:1, countryCode:1}),
        getTasksByIds(subTaskIds, token)
    ]) 
    return activities.map((activity: any) => ({...activity.toJSON(),
        subTask: subTasks.find((subTask: any) => subTask._id == activity.subTask),
        activityBy: usersInfo.find((user: any) => user._id == activity.activityBy),
        addedUserIds: usersInfo.filter((s: any) => (activity.addedUserIds || []).includes(s._id)),
        removedUserIds: usersInfo.filter((s: any) => (activity.removedUserIds || []).includes(s._id)),
    }))
}