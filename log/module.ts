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

export async function getTaskLogs(taskId: string) {
    const activities = await ActivitySchema.find({taskId}).exec()
    const userIds = activities.map((activity: any) => (activity.addedUserIds || []).concat(activity.removedUserIds || []).concat([activity.activityBy])).filter((v: string) => v)
    const subTaskIds = activities.map((activity: any) => activity.subTask).filter(v => !!v)
    const [usersInfo, subTasks] = await Promise.all([
        userFindMany('_id', userIds),
        getTasksByIds(subTaskIds)
    ]) 
    return activities.map((activity: any) => ({...activity.toJSON(),
        subTask: subTasks.find((subTask: any) => subTask._id == activity.subTask),
        activityBy: usersInfo.find((user: any) => user._id == activity.activityBy),
        addedUserIds: (activity.addedUserIds || []).map((userId: string) => usersInfo.filter((s: any) => s._id == userId)),
        removedUserIds: (activity.removedUserIds || []).map((userId: string) => usersInfo.filter((s: any) => s._id == userId))
    }))
}