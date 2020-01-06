import { ActivitySchema } from "./model";
import { userFindMany, getTasksByIds, groupPatternMatch } from "../utils/users";
import { Types } from "mongoose";
import { tags } from "../tags/tag_model";
import { checkRoleScope } from "../utils/role_management";
import { APIError } from "../utils/custom-error";
import { TASK_ERROR } from "../utils/error_msg";
import { TASKS_URL } from "../utils/urls";

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
    if (!isEligible) {
        throw new APIError(TASK_ERROR.UNAUTHORIZED_PERMISSION)
    }
    const activities = await ActivitySchema.find({ taskId }).sort({ createdAt: 1 }).exec()
    const userIds = activities.reduce((p: any, activity: any) =>
        [...p, ...
            ((activity.addedUserIds || []).concat(activity.removedUserIds || []).concat([activity.activityBy]))
        ], []).filter((v: string) => v)
    const subTaskIds = activities.reduce((p: any, activity: any) => {
        p = p.concat([activity.subTask, ...(activity.linkedTasks || []), ...(activity.unlinkedTasks || [])])
        return p
    }, []).filter((v: any) => !!v)
    const [usersInfo, subTasks] = await Promise.all([
        userFindMany('_id', userIds, { firstName: 1, lastName: 1, middleName: 1, email: 1, phoneNumber: 1, countryCode: 1, profilePic: 1, phone: 1, is_active: 1 }),
        getTasksByIds(subTaskIds, token)
    ])
    const tagObjects = await tags.find({ _id: { $in: [...new Set(activities.reduce((main: any, curr: any) => [...main, ...(curr.tagsAdded || []), ...(curr.tagsRemoved || [])], []))] } }).exec()
    let logs = activities.map((activity: any) => ({
        ...activity.toJSON(),
        subTask: subTasks.find((subTask: any) => subTask._id == activity.subTask),
        linkedTasks: subTasks.filter((subTask: any) => (activity.linkedTasks || []).includes(subTask._id)),
        unlinkedTasks: subTasks.filter((subTask: any) => (activity.unlinkedTasks || []).includes(subTask._id)),
        activityBy: usersInfo.find((user: any) => user._id == activity.activityBy),
        addedUserIds: usersInfo.filter((s: any) => (activity.addedUserIds || []).includes(s._id)),
        removedUserIds: usersInfo.filter((s: any) => (activity.removedUserIds || []).includes(s._id)),
        tagsAdded: tagObjects.filter(({ id }: any) => (activity.tagsAdded || []).includes(id)),
        tagsRemoved: tagObjects.filter(({ id }: any) => (activity.tagsRemoved || []).includes(id))
    })).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    return logs.map(logObj => getFormantedTaskLogs(logObj))
};

export async function getDocumentsLogs(docId: string, token: string, userObj: any) {
    try {
        const isEligible = await checkRoleScope(userObj.role, `document-activity-log`)
        if (!isEligible) throw new APIError(TASK_ERROR.UNAUTHORIZED_PERMISSION);
        const select = { name: true, description: true }
        const activities: any[] = await ActivitySchema.find({ documentId: Types.ObjectId(docId) }).populate([{ path: 'fromPublished', select }, { path: 'fromPublished', select }, { path: "documentId", select }]).exec()
        let logs = await Promise.all(activities.map((activity: any) => {
            return activityFetchDetails(activity)
        }))
        return logs.map(logObj => getFormantedDocLogs(logObj))
    } catch (err) {
        throw err
    };
};

async function activityFetchDetails(activity: any) {
    const userObj = (activity.documentAddedUsers || []).concat(activity.documentRemovedUsers || []).filter(({ type }: any) => type == "user")
    const groupObj = (activity.documentAddedUsers || []).concat(activity.documentRemovedUsers || []).filter(({ type }: any) => type == "group")
    const userIds = userObj.reduce((main: string[], curr: any) => main.concat(curr.id), [])
    const groupIds = groupObj.reduce((main: string[], curr: any) => main.concat(curr.id), [])
    let groupsData = await groupPatternMatch({}, {}, { "_id": groupIds }, {})
    let usersData = await userFindMany('_id', userIds.concat(activity.activityBy), { firstName: 1, lastName: 1, middleName: 1, email: 1, phoneNumber: 1, countryCode: 1, profilePic: 1, phone: 1, is_active: 1 });
    usersData = groupsData.concat(usersData)
    const tagIds = (activity.tagsAdded || []).concat(activity.tagsRemoved || [])
    const tagsData = await tags.find({ _id: { $in: tagIds } })
    try {
        return {
            ...activity.toJSON(),
            activityBy: usersData.find((users: any) => activity.activityBy == users._id),
            documentAddedUsers: usersData.filter((obj: any) => (activity.documentAddedUsers || []).map((d: any) => d.id).includes(obj._id)),
            documentRemovedUsers: usersData.filter((obj: any) => (activity.documentRemovedUsers || []).map((d: any) => d.id).includes(obj._id)),
            tagsAdded: tagsData.filter((obj: any) => (activity.tagsAdded || []).includes(obj.id)),
            tagsRemoved: tagsData.filter((obj: any) => (activity.tagsRemoved || []).includes(obj.id))
        }
    } catch (err) {
        throw err
    }
}

export async function getProfileLogs(profileId: string, token: string) {
    try {
        const activities: any[] = await ActivitySchema.find({ profileId: Types.ObjectId(profileId) }).exec()
        let logs = await Promise.all(activities.map((activity: any) => {
            return profileFetchDetails(activity.toJSON())
        }))
        return logs.map(logObj=> getFormantedUserLogs(logObj))
    } catch (err) {
        throw err
    };
};

async function profileFetchDetails(activity: any) {
    try {
        let userObj = (activity.profileId) ? await userFindMany("_id", [activity.activityBy, activity.profileId]) : await userFindMany("_id", [activity.activityBy])
        return {
            ...activity,
            activityBy: userObj.find((users: any) => activity.activityBy == users._id),
            profileId: (activity.profileId) ? { firstName: '', lastName: '', middleName: '', email: '', ...userObj.find((users: any) => activity.profileId == users._id) } : ""
        }
    } catch (err) {
        throw err;
    };
};


export async function getMergedLogs() {
    try {
        const activities: any[] = await ActivitySchema.find({ activityType: "MERGED-TAG" }, { activityType: 1, activityBy: 1, mergedTag: 1, tagsToMerge: 1, updatedAt: 1, createdAt: 1 }).exec()
        return await Promise.all(activities.map((activity: any) => {
            return profileFetchDetails(activity.toJSON())
        }))
    } catch (err) {
        throw err
    };
}

export async function projectLogs(projectId: string, token: string, userObj: any) {
    try {
        const isEligible = await checkRoleScope(userObj.role, `project-activity-log`)
        if (!isEligible) throw new APIError(TASK_ERROR.UNAUTHORIZED_PERMISSION);

        const activities: any[] = await ActivitySchema.find({ projectId }).populate({ path: 'projectId' }).exec()
        let taskObjects: any[] = await getTasksByIds([...new Set((activities.reduce((main, curr) => main.concat([curr.taskId]), [])).filter((id: string) => Types.ObjectId(id)))] as any, token)
        let logs = await Promise.all(activities.map((activity: any) => {
            return fetchProjectLogDetails(activity.toJSON(), taskObjects)
        }))
        return logs.map(logObj => getFormantedProjectLogs(logObj))
    } catch (err) {
        throw err
    };
}

async function fetchProjectLogDetails(activity: any, taskObjects: any[]) {
    try {
        let userObj = await userFindMany("_id", [activity.activityBy, ...(activity.addedUserIds || []), ...(activity.removedUserIds || [])])
        return {
            ...activity,
            activityBy: userObj.find(({ _id }: any) => _id == activity.activityBy),
            addedUserIds: userObj.filter(({ _id }: any) => (activity.addedUserIds || []).includes(_id)),
            removedUserIds: userObj.filter(({ _id }: any) => (activity.removedUserIds || []).includes(_id)),
            taskId: taskObjects.find(({ _id }: any) => activity.taskId == _id)
        };
    } catch (err) {
        throw err
    };
};

function getFormantedDocLogs(activityLog: any) {
    let message: string
    switch (activityLog.activityType) {
        case 'DOCUMENT_CREATED':
            message = `${UserFullName(activityLog.activityBy)} created the document`;
            break;
        case 'DOCUMENT_UPDATED':
            message = `${UserFullName(activityLog.activityBy)} updated the document`;
            break;
        case 'CANCEL_UPDATED':
            message = `${UserFullName(activityLog.activityBy)} canceled the document update`;
            break;
        case 'TAGS_ADDED':
            message = `${UserFullName(activityLog.activityBy)} added tags ${getTagName(activityLog.tagsAdded)} to the document`;
            break;
        case 'TAGS_REMOVED':
            message = `${UserFullName(activityLog.activityBy)} removed tags ${getTagName(activityLog.tagsRemoved)} to the document`;
            break;
        case 'MODIFIED_USER_SHARED_AS_VIEWER':
            message = `${UserFullName(activityLog.activityBy)} modified document access from collaborator to viewer to ${getNamesFromIds(activityLog.documentAddedUsers)}`;
            break;
        case 'MODIFIED_USER_SHARED_AS_COLLABORATOR':
            message = `${UserFullName(activityLog.activityBy)} modified document access from viewer to collaborator to ${getNamesFromIds(activityLog.documentAddedUsers)}`;
            break;
        case 'MODIFIED_GROUP_SHARED_AS_VIEWER':
            message = `${UserFullName(activityLog.activityBy)} modified document access from collaborator to viewer to ${getNamesFromIds(activityLog.documentAddedUsers)}`;
            break;
        case 'MODIFIED_GROUP_SHARED_AS_COLLABORATOR':
            message = `${UserFullName(activityLog.activityBy)} modified document access from viewer to collaborator to ${getNamesFromIds(activityLog.documentAddedUsers)}`;
            break;
        case 'DOCUMENT_SHARED_AS_VIEWER':
            message = `${UserFullName(activityLog.activityBy)} shared document to ${getNamesFromIds(activityLog.documentAddedUsers)} with view access`;
            break;
        case 'DOCUMENT_SHARED_AS_COLLABORATOR':
            message = `${UserFullName(activityLog.activityBy)} shared document to ${getNamesFromIds(activityLog.documentAddedUsers)} with edit access`;
            break;
        case 'REMOVED_USER_FROM_DOCUMENT':
            message = `${UserFullName(activityLog.activityBy)} removed access to the document to ${getNamesFromIds(activityLog.documentRemovedUsers)}`;
            break;
        case 'REMOVED_GROUP_FROM_DOCUMENT':
            message = `${UserFullName(activityLog.activityBy)} removed access to the document to ${getNamesFromIds(activityLog.documentRemovedUsers)}`;
            break;
        case 'DOUCMENT_PUBLISHED':
            message = `${UserFullName(activityLog.activityBy)} published the document`;
            break;
        case 'DOUCMENT_UNPUBLISHED':
            message = `${UserFullName(activityLog.activityBy)} unpublished the document`;
            break;
        case 'DOUCMENT_REPLACED':
            message = `${UserFullName(activityLog.activityBy)} replaced the document`;
            break;
        case 'DOCUMENT_DELETED':
            message = `${UserFullName(activityLog.activityBy)} deleted the document`;
            break;
        case 'DOCUMENT_VIEWED':
            message = `${UserFullName(activityLog.activityBy)} viewed the document`;
            break;
        case 'DOCUMENT_COMMENT':
            message = `${UserFullName(activityLog.activityBy)} added a comment`;
            break;
        case 'DOCUMENT_DOWNLOAD':
            message = `${UserFullName(activityLog.activityBy)} Dowloaded a document`;
            break;
        case "TAGS_ADD_AND_REMOVED":
            message = `${UserFullName(activityLog.activityBy)} added tags ${getTagName(activityLog.tagsAdded)} to the document and removed tags ${getTagName(activityLog.tagsRemoved)} to  the document`
            break;
        default:
            message = "";
    }
    return { message, activityBy: activityLog.activityBy._id, createdAt: activityLog.createdAt, activityType: "NEW_RESPONSE" }
}

function UserFullName({ firstName, middleName, lastName }: any) {
    return (firstName ? firstName + " " : "") + (middleName ? middleName + " " : "") + (lastName ? lastName : "");
}

function getTagName(tagsArr: any[]) {
    let namesArr: Array<any> = [];
    let namesStr: string;
    tagsArr.map(item => {
        namesArr.push(item.tag);
    });
    namesStr = namesArr.join();
    return namesStr;
}

function getNamesFromIds(userIdsArr: []) {
    let namesArr: Array<any> = [];
    let namesStr: string;
    userIdsArr.map((item: any) => {
        if (item.firstName && item.lastName) {
            namesArr.push(`${item.firstName} ${item.lastName} `);
        } else {
            namesArr.push(item.name)
        }
    });
    namesStr = namesArr.join();
    return namesStr;
}

function getFormantedTaskLogs(activityLog: any) {
    let message: string
    switch (activityLog.activityType) {
        case 'TASK_CREATED':
            message = `${UserFullName(activityLog.activityBy)} created the task`;
            break;
        case 'ASSIGNEE_CHANGED':
            message = `${UserFullName(activityLog.activityBy)} has changed the assignee from ${activityLog.removedUserIds[0].firstName} ${activityLog.removedUserIds[0].lastName} to ${activityLog.addedUserIds[0].firstName} ${activityLog.addedUserIds[0].lastName}`;
            break;
        case 'APPROVED_BY_USER':
            message = `${UserFullName(activityLog.activityBy)} approved the task`;
            break;
        case 'ENDORSED_BY_USER':
            message = `${UserFullName(activityLog.activityBy)} endorsed the task`;
            break;
        case 'TASK_REOPENED':
            message = `${UserFullName(activityLog.activityBy)} reopened the task`;
            break;
        case 'TASK_REJECTED':
            message = `${UserFullName(activityLog.activityBy)} rejected the task`;
            break;
        case 'STEP_UPDATED':
            message = `${UserFullName(activityLog.activityBy)} has updated the step from ${activityLog.oldStep.name} to ${activityLog.updatedStep.name}`;
            break;
        case 'PILLAR_UPDATED':
            message = `${UserFullName(activityLog.activityBy)} has updated the pillar from ${activityLog.updatedPillar.name} to ${activityLog.updatedPillar.name}`;
            break;
        case 'APPROVERS_UPDATED':
            message = `${UserFullName(activityLog.activityBy)} has added approvers ${getNamesFromIds(activityLog.addedUserIds)} and removed ${getNamesFromIds(activityLog.removedUserIds)}`;
            break;
        case 'ENDORSERS_UPDATED':
            message = `${UserFullName(activityLog.activityBy)} has added endorsers ${getNamesFromIds(activityLog.addedUserIds)} and removed ${getNamesFromIds(activityLog.removedUserIds)}`;
            break;
        case 'SUPPORTERS_UPDATED':
            message = `${UserFullName(activityLog.activityBy)} has added supporters ${getNamesFromIds(activityLog.addedUserIds)} and removed ${getNamesFromIds(activityLog.removedUserIds)}`;
            break;
        case 'VIEWERS_UPDATED':
            message = `${UserFullName(activityLog.activityBy)} has added viewers ${getNamesFromIds(activityLog.addedUserIds)} and removed ${getNamesFromIds(activityLog.removedUserIds)}`;
            break;
        case 'TASK_STATUS_UPDATED':
            message = `${UserFullName(activityLog.activityBy)} has updated the task status from ${getStatus(activityLog.oldStatus, "")} to ${getStatus(activityLog.updatedStatus, "")}`
            break;
        case 'TASK_START_DATE_UPDATED':
            message = `${UserFullName(activityLog.activityBy)} has updated the start date from ${activityLog.previousStartDate} to ${activityLog.updatedStartDate}`;
            break;
        case 'TASK_DUE_DATE_UPDATED':
            message = `${UserFullName(activityLog.activityBy)} has updated the start date from ${activityLog.previousEndDate} to ${activityLog.updatedEndDate}`;
            break;
        case 'DOCUMENTS_ADDED':
            message = `${UserFullName(activityLog.activityBy)} added documents to the task`;
            break;
        case 'SUBTASK_ADDED':
            message = `${UserFullName(activityLog.activityBy)} added subtask ${(activityLog.subTask || {}).name}`;
            break;
        case 'DOCUMENTS_REMOVED':
            message = `${UserFullName(activityLog.activityBy)} removed documents to the task`;
            break;
        case 'SUBTASK_REMOVED':
            message = `${UserFullName(activityLog.activityBy)} removed subtask ${(activityLog.subTask || {}).name}`;
            break;
        case 'NEW_TASK_LINKED':
            message = `${UserFullName(activityLog.activityBy)} linked task ${(activityLog.subTask || {}).name} on`;
            break;
        case 'LINKED_TASK_REMOVED':
            message = `${UserFullName(activityLog.activityBy)} removed linked task ${(activityLog.subTask || {}).name}`;
            break;
        case 'TAGS_UPDATED':
            message = `${UserFullName(activityLog.activityBy)} updated tags`;
            break;
        default:
            message = "";
    }
    return { message, activityBy: activityLog.activityBy._id, createdAt: activityLog.createdAt, activityType: "NEW_RESPONSE" }
}

function getStatus(status_code: any, status: any = "") {
    switch (status_code) {
        case 0:
            return "Create";
        case 1:
            return status = "reject" ? ' Rejected ' : status = "reopen" ? 'Reopened' : 'To Do';
        case 2:
            return 'In Progress';
        case 3:
            return 'Pending Approval';
        case 4:
            return 'Approved';
        case 5:
            return 'Completed';
        case 6:
            return "Rejected";
        case 7:
            return 'Request For Re-assignment';
        case 8:
            return 'Cancelled';
        case 9:
            return 'Pending Endorsement';
        case 10:
            return 'Endorsed';
    }
}

function getFormantedProjectLogs(activityLog: any) {
    let message: string
    switch (activityLog.activityType) {
        case 'PROJECT_CREATED':
            message = `${UserFullName(activityLog.activityBy)} created ${activityLog.projectId.name}`;
            break;
        case 'TASK_DATES_UPDATED':
            message = `${UserFullName(activityLog.activityBy)} updated the task start date`;
            break;
        case 'CREATE_TASK_FROM_PROJECT':
            message = `${UserFullName(activityLog.activityBy)} created  task ${activityLog.taskId ? activityLog.taskId.name : ""}`;
            break;
        case 'PROJECT_MEMBERS_UPDATED':
            message = `${UserFullName(activityLog.activityBy)} added ${getNamesFromIds(activityLog.addedUserIds)} as a Core Team member`;
            break;
        case 'ADDED_FUND_RELEASE':
            message = `${UserFullName(activityLog.activityBy)} added fund release to ${activityLog.updatedCost} INR`;
            break;
        case 'ADDED_FUND_UTILIZATION':
            message = `${UserFullName(activityLog.activityBy)} added fund utilisation to ${activityLog.updatedCost} INR`;
            break;
        case 'UPDATED_FUND_RELEASE':
            message = `${UserFullName(activityLog.activityBy)} updated fund release to ${activityLog.updatedCost} INR`;
            break;
        case 'UPDATED_FUND_UTILIZATION':
            message = `${UserFullName(activityLog.activityBy)} updated fund utilization to ${activityLog.updatedCost} INR`;
            break;
        case 'UPDATED_CITIIS_GRANTS':
            message = `${UserFullName(activityLog.activityBy)} updated citiis grants to ${activityLog.updatedCost} INR`;
            break;
        case 'UPDATED_PROJECT_COST':
            message = `${UserFullName(activityLog.activityBy)} updated project cost to ${activityLog.updatedCost} INR`;
            break;
        case 'REPLACE_USER':
            message = "";
            break;
        default:
            message = "";
    }
    return { message, activityBy: activityLog.activityBy._id, createdAt: activityLog.createdAt, activityType: "NEW_RESPONSE" }
}

function getFormantedUserLogs(activityLog: any) {
    let message: string
    switch (activityLog.activityType) {
        case 'INVITE-USER':
            message = `${activityLog.activityBy.firstName} ${activityLog.activityBy.lastName} sent Invitation to ${activityLog.profileId.email} .`
            break;
        case 'REGISTER-USER':
            message = `${activityLog.activityBy.firstName} ${activityLog.activityBy.lastName} has been Registered on CMP .`
            break;

        case 'EDIT-PROFILE':
            message = `${activityLog.profileId.firstName} ${activityLog.profileId.lastName} edited their profile for ${activityLog.editedFields.length > 0 ? (activityLog.editedFields.slice(0, activityLog.editedFields.length)) : 'No'} ${activityLog.editedFields.length > 1 ? 'fields.' : 'field.'}`
            break;

        case 'EDIT-PROFILE-BY-ADMIN':
            message = `${activityLog.profileId.firstName} ${activityLog.profileId.lastName}'s profile has been edited by ${activityLog.activityBy.firstName} ${activityLog.activityBy.lastName} for ${activityLog.editedFields.length > 0 ? (activityLog.editedFields) : 'No'} ${activityLog.editedFields.length > 1 ? 'fields.' : 'field.'}`
            break;

        case 'ACTIVATE-PROFILE':
            message = `${activityLog.profileId.firstName} ${activityLog.profileId.lastName}'s profile has been activated by ${activityLog.activityBy.firstName} ${activityLog.activityBy.lastName} .`
            break;

        case 'DEACTIVATE-PROFILE':
            message = `${activityLog.profileId.firstName} ${activityLog.profileId.lastName}'s profile has been deactivated by ${activityLog.activityBy.firstName} ${activityLog.activityBy.lastName} .`
            break;

        case 'RESEND-INVITE-USER':
            message = `${activityLog.activityBy.firstName} ${activityLog.activityBy.lastName} has resent the invitation to ${activityLog.profileId.email} .`
            break;

        case 'EDIT-ROLE':
            message = `${activityLog.profileId.firstName} ${activityLog.profileId.lastName}'s role has been edited by ${activityLog.activityBy.firstName} ${activityLog.activityBy.lastName} .`
            break;
        default:
            message = "";

    }
    return { message, activityBy: activityLog.activityBy._id, createdAt: activityLog.createdAt, activityType: "NEW_RESPONSE" }

}