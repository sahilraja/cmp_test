import { ActivitySchema } from "./model";
import { userFindMany, getTasksByIds, groupPatternMatch } from "../utils/users";
import { Types } from "mongoose";
import { tags } from "../tags/tag_model";
import { checkRoleScope } from "../utils/role_management";
import { APIError } from "../utils/custom-error";
import { TASK_ERROR } from "../utils/error_msg";

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

export async function paginatedList(query = {}, page = 1, limit = 20) {
    return await ActivitySchema.paginate(query, { page, limit })
}

export async function getTaskLogs(taskId: string, token: string, userRole: string) {
    const isEligible = await checkRoleScope(userRole, `view-activity-log`)
    if(!isEligible){
        throw new APIError(TASK_ERROR.UNAUTHORIZED_PERMISSION)
    }
    const activities = await ActivitySchema.find({ taskId }).sort({createdAt:1}).exec()
    const userIds = activities.reduce((p: any, activity: any) =>
        [...p, ...
            ((activity.addedUserIds || []).concat(activity.removedUserIds || []).concat([activity.activityBy]))
        ], []).filter((v: string) => v)
    const subTaskIds = activities.map((activity: any) => activity.subTask).filter(v => !!v)
    const [usersInfo, subTasks] = await Promise.all([
        userFindMany('_id', userIds, { firstName: 1, lastName: 1, middleName: 1, email: 1, phoneNumber: 1, countryCode: 1, profilePic:1 }),
        getTasksByIds(subTaskIds, token)
    ])
    return activities.map((activity: any) => ({
        ...activity.toJSON(),
        subTask: subTasks.find((subTask: any) => subTask._id == activity.subTask),
        activityBy: usersInfo.find((user: any) => user._id == activity.activityBy),
        addedUserIds: usersInfo.filter((s: any) => (activity.addedUserIds || []).includes(s._id)),
        removedUserIds: usersInfo.filter((s: any) => (activity.removedUserIds || []).includes(s._id)),
    })).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
};

export async function getDocumentsLogs(DocID: string, token: string) {
    try {
        const select = {name: true, description: true}
        const activities: any[] = await ActivitySchema.find({ documentId: Types.ObjectId(DocID) }).populate([{ path: 'fromPublished', select }, { path: 'fromPublished', select }, { path: "documentId", select }]).exec()
        return await Promise.all(activities.map((activity: any) => {
            return activityFetchDetails(activity)
        }))
    } catch (err) {
        throw err
    };
};

async function activityFetchDetails(activity: any) {
    const  userObj = (activity.documentAddedUsers || []).concat(activity.documentRemovedUsers || []).filter(({type}: any)=> type == "user")
    const  groupObj = (activity.documentAddedUsers || []).concat(activity.documentRemovedUsers || []).filter(({type}: any)=> type == "group")
    const userIds = userObj.reduce((main: string[], curr: any) => main.concat(curr.id), [])
    const groupIds = groupObj.reduce((main: string[], curr: any) => main.concat(curr.id), [])
    let groupsData = await groupPatternMatch({},{},{"_id": groupIds},{})
    let usersData = await userFindMany('_id', userIds.concat(activity.activityBy), { firstName: 1, lastName: 1, middleName: 1, email: 1, phoneNumber: 1, countryCode: 1, profilePic: 1 });
    usersData = groupsData.concat(usersData)
    const tagIds = (activity.tagsAdded || []).concat(activity.tagsRemoved || [])
    const tagsData = await tags.find({ _id: { $in: tagIds } })
    try {
        return {
            ...activity.toJSON(),
            activityBy: usersData.find((users: any)=> activity.activityBy == users._id),
            documentAddedUsers: usersData.filter((obj: any) => (activity.documentAddedUsers || []).map((d: any) => d.id).includes(obj._id)),
            documentRemovedUsers: usersData.filter((obj: any) => (activity.documentRemovedUsers || []).map((d: any) => d.id).includes(obj._id)),
            tagsAdded: tagsData.filter((obj: any) => (activity.tagsAdded || []).includes(obj.id)),
            tagsRemoved: tagsData.filter((obj: any) => (activity.tagsRemoved || []).includes(obj.id))
        }
    } catch (err) {
        throw err
    }
}

export async function getProfileLogs(token: string) {
    try {
        const activities: any[] = await ActivitySchema.find({ profileId: Types.ObjectId(profileId) }).exec()
        return await Promise.all(activities.map((activity: any) => {
            return profileFetchDetails(activity.toJSON())
        }))
    } catch (err) {
        throw err
    };
};

async function profileFetchDetails(activity: any){
    try {
        let userObj = await userFindMany("_id", [activity.activityBy, activity.profileId])
        return {
            ...activity,
            activityBy: userObj.find((users: any)=> activity.activityBy == users._id),
            profileId: userObj.find((users: any)=> activity.profileId == users._id)
        }
    } catch (err) {
        throw err;
    };
};
export async function getMergedLogs() {
    try {
        const activities: any[] = await ActivitySchema.find({mergedTag}).exec()
        return await Promise.all(activities.map((activity: any) => {
            return profileFetchDetails(activity.toJSON())
        }))
    } catch (err) {
        throw err
    };
}