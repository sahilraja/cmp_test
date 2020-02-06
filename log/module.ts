import { ActivitySchema } from "./model";
import { userFindMany, getTasksByIds, groupPatternMatch } from "../utils/users";
import { Types } from "mongoose";
import { tags } from "../tags/tag_model";
import { checkRoleScope } from "../utils/role_management";
import { APIError } from "../utils/custom-error";
import { TASK_ERROR } from "../utils/error_msg";
import { TASKS_URL } from "../utils/urls";
import { replaceAll } from "../patterns/module";

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
    const activities = await ActivitySchema.find({ taskId }).populate([{path:'oldStepId'},{path:'stepId'},{path:'oldPillarId'},{path:'pillarId'}]).sort({ createdAt: 1 }).exec()
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
    return (logs.map(logObj => getFormantedTaskLogs(logObj))).reverse()
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
        return (logs.map(logObj => getFormantedDocLogs(logObj))).reverse()
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
    let usersData = await userFindMany('_id', [... new Set(userIds.concat(activity.activityBy, activity.requestUserId).filter((id: string) => Types.ObjectId(id)))], { firstName: 1, lastName: 1, middleName: 1, email: 1, phoneNumber: 1, countryCode: 1, profilePic: 1, phone: 1, is_active: 1 });
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
            tagsRemoved: tagsData.filter((obj: any) => (activity.tagsRemoved || []).includes(obj.id)),
            requestUserId: usersData.find((users: any) => activity.requestUserId == users._id)
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
        return (logs.map(logObj => getFormantedUserLogs(logObj))).reverse()
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

        const activities: any[] = await ActivitySchema.find({ projectId }).populate([{ path: 'projectId' },{ path: 'oldStepId' },{ path: 'stepId' }, { path: 'oldPillarId' }, { path: 'pillarId' }]).exec()
        let taskObjects: any[] = await getTasksByIds([...new Set((activities.reduce((main, curr) => main.concat([curr.taskId]), [])).filter((id: string) => Types.ObjectId(id)))] as any, token)
        let logs = await Promise.all(activities.map((activity: any) => {
            return fetchProjectLogDetails(activity.toJSON(), taskObjects)
        }))
        return (logs.map(logObj => getFormantedProjectLogs(logObj))).reverse()
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
            message = `${UserFullName(activityLog.activityBy)} updated the document with new ${activityLog.message}`;
            break;
        case 'CANCEL_UPDATED':
            message = `${UserFullName(activityLog.activityBy)} cancelled editing the document`;
            break;
        case 'TAGS_ADDED':
            message = `${UserFullName(activityLog.activityBy)} added tags ${getTagName(activityLog.tagsAdded)} to the document`;
            break;
        case 'TAGS_REMOVED':
            message = `${UserFullName(activityLog.activityBy)} removed tags ${getTagName(activityLog.tagsRemoved)} from the document`;
            break;
        case 'MODIFIED_USER_SHARED_AS_VIEWER':
            message = `${UserFullName(activityLog.activityBy)} modified document access from collaborator to viewer for ${getNamesFromIds(activityLog.documentAddedUsers)}`;
            break;
        case 'MODIFIED_USER_SHARED_AS_COLLABORATOR':
            message = `${UserFullName(activityLog.activityBy)} modified document access from viewer to collaborator for  ${getNamesFromIds(activityLog.documentAddedUsers)}`;
            break;
        case 'MODIFIED_GROUP_SHARED_AS_VIEWER':
            message = `${UserFullName(activityLog.activityBy)} modified document access from collaborator to viewer for ${getNamesFromIds(activityLog.documentAddedUsers)}`;
            break;
        case 'MODIFIED_GROUP_SHARED_AS_COLLABORATOR':
            message = `${UserFullName(activityLog.activityBy)} modified document access from viewer to collaborator for  ${getNamesFromIds(activityLog.documentAddedUsers)}`;
            break;
        case 'DOCUMENT_SHARED_AS_VIEWER':
            message = `${UserFullName(activityLog.activityBy)} shared document with ${getNamesFromIds(activityLog.documentAddedUsers)} with view access`;
            break;
        case 'DOCUMENT_SHARED_AS_COLLABORATOR':
            message = `${UserFullName(activityLog.activityBy)} shared document with ${getNamesFromIds(activityLog.documentAddedUsers)} with edit access`;
            break;
        case 'REMOVED_USER_FROM_DOCUMENT':
            message = `${UserFullName(activityLog.activityBy)} removed access to the document for ${getNamesFromIds(activityLog.documentRemovedUsers)}`;
            break;
        case 'REMOVED_GROUP_FROM_DOCUMENT':
            message = `${UserFullName(activityLog.activityBy)} removed access to the document for ${getNamesFromIds(activityLog.documentRemovedUsers)} group`;
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
            message = `${UserFullName(activityLog.activityBy)} added a comment to the document`;
            break;
        case 'DOCUMENT_DOWNLOAD':
            message = `${UserFullName(activityLog.activityBy)} downloaded the document`;
            break;
        case "TAGS_ADD_AND_REMOVED":
            message = `${UserFullName(activityLog.activityBy)} added tags ${getTagName(activityLog.tagsAdded)} to the document and removed tags ${getTagName(activityLog.tagsRemoved)} from the document`
            break;
        case "REQUEST_DOCUMENT":
            message = `${UserFullName(activityLog.activityBy)} requested for document access`
            break;
        case "REQUEST_APPROVED":
            message = `${UserFullName(activityLog.activityBy)} approved the request for document access to ${UserFullName(activityLog.requestUserId)}.`
            break;
        case "REQUEST_DENIED":
            message = `${UserFullName(activityLog.activityBy)} rejected the request for document access to ${UserFullName(activityLog.requestUserId)}.`
            break;
        case "SUGGEST_TAGS":
            message = `${UserFullName(activityLog.activityBy)} suggested tags ${getTagName(activityLog.tagsAdded)} to the document.`
            break;
        case "SUGGEST_MODIFIED_TAGS":
            if (activityLog.tagsAdded && activityLog.tagsAdded.length && activityLog.tagsRemoved && activityLog.tagsRemoved.length) {
                message = `${UserFullName(activityLog.activityBy)} ${activityLog.tagsAdded && activityLog.tagsAdded.length ? "suggested tags " + getTagName(activityLog.tagsAdded) : ""}${activityLog.tagsRemoved && activityLog.tagsRemoved.length ? "and suggest remove tags " + getTagName(activityLog.tagsRemoved) : ""} to the document.`
            } else if (activityLog.tagsAdded && activityLog.tagsAdded.length) {
                message = `${UserFullName(activityLog.activityBy)} ${activityLog.tagsAdded && activityLog.tagsAdded.length ? "suggested tags " + getTagName(activityLog.tagsAdded) : ""} to the document.`
            } else if (activityLog.tagsRemoved && activityLog.tagsRemoved.length) {
                message = `${UserFullName(activityLog.activityBy)} ${activityLog.tagsRemoved && activityLog.tagsRemoved.length ? "and suggest remove tags " + getTagName(activityLog.tagsRemoved) : ""} to the document.`
            } else {
                message = `${UserFullName(activityLog.activityBy)} suggest new tags to the document.`
            }
            break;
        case "SUGGEST_TAGS_ADDED_MODIFIED":
            message = `${UserFullName(activityLog.activityBy)} remove from the suggested tags ${getTagName(activityLog.tagsRemoved)} to the document.`
            break;
        case "SUGGEST_TAGS_ADD_APPROVED":
            message = `${UserFullName(activityLog.activityBy)} approved the tags ${getTagName(activityLog.tagsAdded)} suggested to the document.`
            break;
        case "SUGGEST_TAGS_REMOVE_APPROVED":
            message = `${UserFullName(activityLog.activityBy)} approved the tags ${getTagName(activityLog.tagsRemoved)} suggested for removal on the document.`
            break;
        case "SUGGEST_TAGS_ADD_REJECTED":
            message = `${UserFullName(activityLog.activityBy)} rejected the tags ${getTagName(activityLog.tagsRemoved)} suggested to the document.`
            break;
        case "SUGGEST_TAGS_REMOVE_REJECTED":
            message = `${UserFullName(activityLog.activityBy)} rejected the tags ${getTagName(activityLog.tagsRemoved)} suggested for removal on the document.`
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
            namesArr.push(`${item.firstName} ${item.middleName || ''} ${item.lastName} `);
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
        case `PROGRESS_PERCENTAGE_UPDATED`:
            message = `${UserFullName(activityLog.activityBy)} updated the progress percentage`
            break;
        case 'TASK_CREATED':
            message = `${UserFullName(activityLog.activityBy)} created the task`;
            break;
        case 'ASSIGNEE_CHANGED':
            message = `${UserFullName(activityLog.activityBy)} has changed the assignee for the task from ${UserFullName(activityLog.removedUserIds[0])} to ${UserFullName(activityLog.addedUserIds[0])}`;
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
            message = `${UserFullName(activityLog.activityBy)} has updated the step from ${activityLog.oldStepId ? activityLog.oldStepId.name : `None`} to ${activityLog.stepId ? activityLog.stepId.name : `None`}`;
            break;
        case 'PILLAR_UPDATED':
            message = `${UserFullName(activityLog.activityBy)} has updated the pillar from ${activityLog.oldPillarId ? activityLog.oldPillarId.name : `None`} to ${activityLog.pillarId ? activityLog.pillarId.name : `None`}`;
            break;
        case 'APPROVERS_UPDATED':
            if (activityLog.addedUserIds && activityLog.addedUserIds.length && activityLog.removedUserIds && activityLog.removedUserIds.length) {
                message = `${UserFullName(activityLog.activityBy)} has added ${getNamesFromIds(activityLog.addedUserIds)} and removed ${getNamesFromIds(activityLog.removedUserIds)} as approver(s)`;
            } else if (activityLog.addedUserIds && activityLog.addedUserIds.length) {
                message = `${UserFullName(activityLog.activityBy)} has added ${getNamesFromIds(activityLog.addedUserIds)} as approver(s)`;
            } else {
                message = `${UserFullName(activityLog.activityBy)} has removed ${getNamesFromIds(activityLog.removedUserIds)} as approver(s)`;
            }
            break;
        case 'ENDORSERS_UPDATED':
            if (activityLog.addedUserIds && activityLog.addedUserIds.length && activityLog.removedUserIds && activityLog.removedUserIds.length) {
                message = `${UserFullName(activityLog.activityBy)} has added ${getNamesFromIds(activityLog.addedUserIds)} and removed ${getNamesFromIds(activityLog.removedUserIds)} as endorser(s)`;
            } else if (activityLog.addedUserIds && activityLog.addedUserIds.length) {
                message = `${UserFullName(activityLog.activityBy)} has added ${getNamesFromIds(activityLog.addedUserIds)} as endorser(s)`;
            } else {
                message = `${UserFullName(activityLog.activityBy)} has removed ${getNamesFromIds(activityLog.removedUserIds)} as endorser(s)`;
            }
            break;
        case 'SUPPORTERS_UPDATED':
            if (activityLog.addedUserIds && activityLog.addedUserIds.length && activityLog.removedUserIds && activityLog.removedUserIds.length) {
                message = `${UserFullName(activityLog.activityBy)} has added ${getNamesFromIds(activityLog.addedUserIds)} and removed ${getNamesFromIds(activityLog.removedUserIds)} as supporter(s)`;
            } else if (activityLog.addedUserIds && activityLog.addedUserIds.length) {
                message = `${UserFullName(activityLog.activityBy)} has added ${getNamesFromIds(activityLog.addedUserIds)} as supporter(s)`;
            } else {
                message = `${UserFullName(activityLog.activityBy)} has removed ${getNamesFromIds(activityLog.removedUserIds)} as supporter(s)`;
            }
            break;
        case 'VIEWERS_UPDATED':
            if (activityLog.addedUserIds && activityLog.addedUserIds.length && activityLog.removedUserIds && activityLog.removedUserIds.length) {
                message = `${UserFullName(activityLog.activityBy)} has added ${getNamesFromIds(activityLog.addedUserIds)} and removed ${getNamesFromIds(activityLog.removedUserIds)} as viewer(s)`;
            } else if (activityLog.addedUserIds && activityLog.addedUserIds.length) {
                message = `${UserFullName(activityLog.activityBy)} has added ${getNamesFromIds(activityLog.addedUserIds)} as viewer(s)`;
            } else {
                message = `${UserFullName(activityLog.activityBy)} has removed ${getNamesFromIds(activityLog.removedUserIds)} as viewer(s)`;
            }
            break;
        case 'TASK_STATUS_UPDATED':
            message = activityLog.displayMessage ? replaceAll(activityLog.displayMessage, `[from]`, `${UserFullName(activityLog.activityBy)}`)  : `${UserFullName(activityLog.activityBy)} has updated the task status from ${getStatus(activityLog.oldStatus, "")} to ${getStatus(activityLog.updatedStatus, "")}`
            break;
        case 'TASK_START_DATE_UPDATED':
            // message = `${UserFullName(activityLog.activityBy)} has updated the start date from %date:${activityLog.previousStartDate}% to %date:${activityLog.updatedStartDate}%`;
            message = `${UserFullName(activityLog.activityBy)} has updated the task start date`;
            break;
        case 'TASK_DUE_DATE_UPDATED':
            // message = `${UserFullName(activityLog.activityBy)} has updated the due date from %date:${activityLog.previousDueDate}% to %date:${activityLog.updatedDueDate}%`;
            message = `${UserFullName(activityLog.activityBy)} has updated the task due date`;
            break;
        case 'DOCUMENTS_ADDED':
            message = `${UserFullName(activityLog.activityBy)} added documents to the task`;
            break;
        case 'SUBTASK_ADDED':
            message = `${UserFullName(activityLog.activityBy)} added subtask ${(activityLog.subTask || {}).name} to the task`;
            break;
        case 'DOCUMENTS_REMOVED':
            message = `${UserFullName(activityLog.activityBy)} removed documents from the task`;
            break;
        case 'SUBTASK_REMOVED':
            message = `${UserFullName(activityLog.activityBy)} removed subtask ${(activityLog.subTask || {}).name} from the task`;
            break;
        case 'NEW_TASK_LINKED':
            message = `${UserFullName(activityLog.activityBy)} linked ${(activityLog.linkedTasks.reduce((p: string[],c: any) => p.concat([c.name]) , []).join(`,`))} task to the task`;
            break;
        case 'LINKED_TASK_REMOVED':
            message = `${UserFullName(activityLog.activityBy)} removed linked task ${(activityLog.unlinkedTasks.reduce((p: string[],c: any) => p.concat([c.name]) , []).join(`,`))} from the task`;
            break;
        case 'TAGS_UPDATED':
            message = `${UserFullName(activityLog.activityBy)} updated tags to the task`;
            break;
        case "SUGGEST_TAGS_ADD_APPROVED":
            message = `${UserFullName(activityLog.activityBy)} approved the tags ${getTagName(activityLog.tagsAdded)} suggested to the task.`
            break;
        case "SUGGEST_TAGS_REMOVE_APPROVED":
            message = `${UserFullName(activityLog.activityBy)} approved the tags ${getTagName(activityLog.tagsRemoved)} suggested for removal on the task.`
            break;
        case "SUGGEST_TAGS_ADD_REJECTED":
            message = `${UserFullName(activityLog.activityBy)} rejected the tags ${getTagName(activityLog.tagsRemoved)} suggested to the task.`
            break;
        case "SUGGEST_TAGS_REMOVE_REJECTED":
            message = `${UserFullName(activityLog.activityBy)} rejected the tags ${getTagName(activityLog.tagsRemoved)} suggested for removal on the task.`
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
            return status == "reject" ? ' Rejected ' : status == "reopen" ? 'Reopened' : 'To Do';
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
        case `PROJECT_UPDATED`:
            message = `${UserFullName(activityLog.activityBy)} has updated the project details`
            break;
        case 'STEP_UPDATED':
            message = `${UserFullName(activityLog.activityBy)} has updated the step to the task ${activityLog.taskId.name}`;
            break;
        case 'PILLAR_UPDATED':
            message = `${UserFullName(activityLog.activityBy)} has updated the pillar to the task ${activityLog.taskId.name}`;
            break;
        case `RISK_CREATED`:
            message = `${UserFullName(activityLog.activityBy)} has created a risk ${activityLog.riskOpportunityNumber}`
            break;
        case `OPPORTUNITY_CREATED`:
            message = `${UserFullName(activityLog.activityBy)} has created a opportunity ${activityLog.riskOpportunityNumber}`
            break;
        case `RISK_UPDATED`:
            message = `${UserFullName(activityLog.activityBy)} has updated the risk ${activityLog.riskOpportunityNumber}`
            break;
        case `OPPORTUNITY_UPDATED`:
            message = `${UserFullName(activityLog.activityBy)} has updated the opportunity ${activityLog.riskOpportunityNumber}`
            break;
        case `ADDED_MISCOMPLIANCE_SPV`:
            message = `${UserFullName(activityLog.activityBy)} has added the SPV compliance`
            break;
        case `ADDED_MISCOMPLIANCE_PROJECT`:
            message = `${UserFullName(activityLog.activityBy)} has added the Project compliance`            
            break;
        case `EDIT_MISCOMPLIANCE_SPV`:
            message = `${UserFullName(activityLog.activityBy)} has updated the SPV compliance`
            break;
        case `EDIT_MISCOMPLIANCE_PROJECT`:
            message = `${UserFullName(activityLog.activityBy)} has updated the Project compliance`            
            break;
        case `REMOVE_MISCOMPLIANCE_SPV`:
            message = `${UserFullName(activityLog.activityBy)} has removed the SPV compliance`
            break;
        case `REMOVE_MISCOMPLIANCE_PROJECT`:
            message = `${UserFullName(activityLog.activityBy)} has removed the Project compliance`
            break;
        case `TRIPART_DATE_UPDATED`:
            message = `${UserFullName(activityLog.activityBy)} has updated the Tri-partite Agreement Date`
            break;
        case `PROGRESS_PERCENTAGE_UPDATED`:
            message = `${UserFullName(activityLog.activityBy)} updated the progress percentage for the task ${activityLog.taskId ? activityLog.taskId.name : ""}`
            break;
        case 'TASK_START_DATE_UPDATED':
            // message = `${UserFullName(activityLog.activityBy)} has updated the start date from %date:${activityLog.previousStartDate}% to %date:${activityLog.updatedStartDate}%`;
            message = `${UserFullName(activityLog.activityBy)} has updated the start date for the task ${activityLog.taskId ? activityLog.taskId.name : ""}`;
            break;
        case 'TASK_DUE_DATE_UPDATED':
            // message = `${UserFullName(activityLog.activityBy)} has updated the due date from %date:${activityLog.previousDueDate}% to %date:${activityLog.updatedDueDate}%`;
            message = `${UserFullName(activityLog.activityBy)} has updated the due date for the task ${activityLog.taskId ? activityLog.taskId.name : ""}`;
            break;
        case 'PROJECT_CREATED':
            message = `${UserFullName(activityLog.activityBy)} created the Project`;
            break;
        case 'TASK_DATES_UPDATED':
            message = `${UserFullName(activityLog.activityBy)} updated the task start date`;
            break;
        case 'CREATE_TASK_FROM_PROJECT':
            message = `${UserFullName(activityLog.activityBy)} created task ${activityLog.taskId ? activityLog.taskId.name : ""}`;
            break;
        case 'PROJECT_MEMBERS_UPDATED':
            message = `${UserFullName(activityLog.activityBy)} added ${getNamesFromIds(activityLog.addedUserIds)} as a core team member`;
            break;
        case 'MEMBER_ADDED':
            message = `${UserFullName(activityLog.activityBy)} added ${getNamesFromIds(activityLog.addedUserIds)} to the core team`;
            break;
        case 'MEMBER_REMOVED':
            message = `${UserFullName(activityLog.activityBy)} removed ${getNamesFromIds(activityLog.removedUserIds)} from the core team`;
            break;
        case 'ADDED_FUND_RELEASE':
            message = `${UserFullName(activityLog.activityBy)} added ${activityLog.updatedCost} INR to fund released`;
            break;
        case 'ADDED_FUND_UTILIZATION':
            message = `${UserFullName(activityLog.activityBy)} added ${activityLog.updatedCost} INR to fund utilised`;
            break;
        case 'UPDATED_FUND_RELEASE':
            message = `${UserFullName(activityLog.activityBy)} updated fund released to ${activityLog.updatedCost} INR`;
            break;
        case 'UPDATED_FUND_UTILIZATION':
            message = `${UserFullName(activityLog.activityBy)} updated fund utilised to ${activityLog.updatedCost} INR`;
            break;
        case `DELETED_FUND_RELEASE`:
            message = `${UserFullName(activityLog.activityBy)} deleted the funds released`
            break;
        case `DELETED_FUND_UTILIZATION`:
            message = `${UserFullName(activityLog.activityBy)} deleted the funds utilized`
            break;
        case `INSTALLMENT_ADDED`:
            message = `${UserFullName(activityLog.activityBy)} added installments to the project`
            break;
        case `INSTALLMENT_UPDATED`:
            message = `${UserFullName(activityLog.activityBy)} updated installments to the project`
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
            message = `${UserFullName(activityLog.activityBy)} sent Invitation to ${activityLog.profileId.email} .`
            break;
        case 'REGISTER-USER':
            message = `${UserFullName(activityLog.activityBy)} has been Registered on CMP .`
            break;

        case 'EDIT-PROFILE':
            message = `${UserFullName(activityLog.profileId)} profile has been updated with ${activityLog.editedFields.length > 0 ? (activityLog.editedFields.slice(0, activityLog.editedFields.length)) : 'No'} ${activityLog.editedFields.length > 1 ? 'fields.' : 'field.'}`
            break;

        case 'EDIT-PROFILE-BY-ADMIN':
            message = `${UserFullName(activityLog.profileId) || `User`}'s profile has been edited by ${UserFullName(activityLog.activityBy)} with ${activityLog.editedFields.length > 0 ? (activityLog.editedFields) : 'No'} ${activityLog.editedFields.length > 1 ? 'fields.' : 'field.'}`
            break;

        case 'ACTIVATE-PROFILE':
            message = `${UserFullName(activityLog.profileId)}'s profile has been activated by ${UserFullName(activityLog.activityBy)} .`
            break;

        case 'DEACTIVATE-PROFILE':
            message = `${UserFullName(activityLog.profileId)}'s profile has been deactivated by ${UserFullName(activityLog.activityBy)} .`
            break;

        case 'RESEND-INVITE-USER':
            message = `${UserFullName(activityLog.activityBy)} has resent the invitation to ${activityLog.profileId.email} .`
            break;

        case 'EDIT-ROLE':
            message = `${UserFullName(activityLog.profileId) || `User`}'s role has been edited by ${UserFullName(activityLog.activityBy)} .`
            break;

        case 'ADMIN-PASSWORD-UPDATE':
            message = `${UserFullName(activityLog.activityBy)} has been updated the password.`
            break;

        case 'ADMIN-EMAIL-UPDATE':
            message = `${UserFullName(activityLog.activityBy)} has updated the email to ${activityLog.profileId.email}.`
            break;

        case 'ADMIN-PHONENO-UPADTE':
            message = `${UserFullName(activityLog.activityBy)} has updated the phone number to ${UserFullName(activityLog.profileId)}.`
            break;

        case 'USER-EMAIL-UPADTE':
            message = `${UserFullName(activityLog.activityBy)} has updated the email.`
            break;

        case 'USER-PHONE-UPADTE':
            message = `${UserFullName(activityLog.activityBy)} has updated the phone number.`
            break;

        case 'USER_PASSWORD_UPDATE':
            message = `${UserFullName(activityLog.activityBy)} has updated the password.`
            break;

        default:
            message = "";

    }
    return { message, activityBy: activityLog.activityBy._id, createdAt: activityLog.createdAt, activityType: "NEW_RESPONSE" }

}