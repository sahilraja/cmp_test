import { privateGroupSchema } from "./model";
import { RESPONSE } from "../utils/error_msg";
import { userFindMany, userFindOne } from "../utils/users";
import { checkRoleScope } from "../utils/role_management";
import { APIError } from "../utils/custom-error";
import { userRoleAndScope } from "../role/module";

export interface privateGroup {
    name: string;
    description: number;
    members: string[];
    createdBy: string;
    is_active: boolean
};

//  create Private Group 
export async function createPrivateGroup(body: any, userObj: any): Promise<object> {
    try {
        const isEligible = await checkRoleScope(userObj.role, "manage-private-group");
        if (!isEligible) throw new APIError("Unautherized Action.", 403);
        if (!body.name || !Array.isArray(body.members) || !body.members.length) throw new Error("Missing Required Fields.");
        if (body.members.includes(userObj._id)) throw new Error("Owner can't be group member.")
        let existGroups = await privateGroupSchema.find({name: body.name, createdBy: userObj._id, is_active: true })
        if(existGroups.length) throw new Error("A private group with same name already exists.") 
        return privateGroupSchema.create({ ...body, createdBy: userObj._id })
    } catch (err) {
        throw err
    };
};

//  edit Private Group
export async function editPrivateGroup(groupId: string, body: any, userId: string): Promise<any> {
    try {
        let groupDetails: any = await privateGroupSchema.findById(groupId).exec();
        if (!groupDetails) throw new Error("Group Not Found.");
        if (groupDetails.createdBy != userId) throw new Error("Unautherized Action.");
        if (body.members && (!Array.isArray(body.members) || !body.members.length)) throw new Error("Minimum one member is required.")
        let existUsersRemoved = body.members.filter((user: any) => !groupDetails.members.includes(user))
        if(!existUsersRemoved.length) throw new Error("Member already exist in this group.")
        body.members = [...new Set(groupDetails.members.concat(body.members))]
        if (body.members.includes(userId)) throw new Error("Owner can't be group member.")
        return await privateGroupSchema.findByIdAndUpdate(groupId, { $set: { ...body } })
    } catch (err) {
        throw err
    };
};

//  edit Private Group
export async function removePrivateGroup(groupId: string, body: privateGroup, userId: string): Promise<any> {
    try {
        let groupDetails: any = await privateGroupSchema.findById(groupId).exec();
        if (!groupDetails) throw new Error("Group Not Found.");
        if (groupDetails.createdBy != userId) throw new Error("Unautherized Action.");
        if (Array.isArray(body.members) && body.members.length) {
            body.members = groupDetails.members.filter((userId: string) => !body.members.includes(userId))
        }
        return await privateGroupSchema.findByIdAndUpdate(groupId, { $set: { ...body } })
    } catch (err) {
        throw err
    };
};

//  change private Group status
export async function privateGroupStatus(groupId: string, userId: string): Promise<any> {
    try {
        let group: any = await privateGroupSchema.findById(groupId).exec();
        if (!group) throw new Error("Group Not Found.");
        if (group.createdBy != userId) throw new Error("Unautherized Action.")
        let data: any = await privateGroupSchema.findByIdAndUpdate(groupId, { $set: { is_active: group.is_active ? false : true } });
        return { message: data.is_active ? RESPONSE.ACTIVE : RESPONSE.INACTIVE };
    } catch (err) {
        throw err;
    };
};

//  Get Group Detail
export async function privateGroupDetails(groupId: string): Promise<any> {
    try {
        let groupDetail: any = await privateGroupSchema.findById(groupId).exec()
        return await groupDetails(groupDetail)
    } catch (err) {
        throw err;
    };
};

//  Get Group Detail
export async function privateGroupList(userId: string, search?: string): Promise<any[]> {
    try {
        let searchQuery = search ? { name: new RegExp(search, "i"), createdBy: userId, is_active: true } : { createdBy: userId, is_active: true }
        let groupList = await privateGroupSchema.find({ ...searchQuery }).exec()
        return await Promise.all(groupList.map((group: any) => groupDetails(group)))
    } catch (err) {
        throw err;
    };
};

async function groupDetails(group: any) {
    try {
        let userData = await userFindMany('_id', group.members.concat([group.createdBy]), { firstName: 1, lastName: 1, middleName: 1, email: 1 })
        userData = await Promise.all(userData.map((user: any) => getUserDateWithRole(user)));
        return {
            ...group.toJSON(),
            createdBy: userData.find((user: any) => user._id == group.createdBy),
            members: userData.filter((user: any) => group.members.includes(user._id))
        }
    } catch (err) {
        throw err;
    };
};

async function getUserDateWithRole(userData: any) {
    return{
        ...userData,
        role: ((await userRoleAndScope(userData._id) as any).data.global || [""])[0]
    };  
};