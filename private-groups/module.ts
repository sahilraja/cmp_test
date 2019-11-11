import { privateGroupSchema } from "./model";
import { RESPONSE } from "../utils/error_msg";
import { userFindMany, userFindOne } from "../utils/users";
import { checkRoleScope } from "../utils/role_management";
import { APIError } from "../utils/custom-error";

export interface privateGroup {
    name: string;
    description: number;
    members: string[];
    createdBy: string;
    is_active: boolean
};

//  create Private Group 
export async function createPrivateGroup(body: privateGroup, userObj: any): Promise<object> {
    try {
        const isEligible = await checkRoleScope(userObj.role, "create-private-group");
        if (!isEligible) throw new APIError("Unautherized Action.", 403);
        if (!body.name || !Array.isArray(body.members)) throw new Error("Missing Required Fields.");
        return privateGroupSchema.create({ ...body, createdBy: userObj._id })
    } catch (err) {
        throw err
    };
};

//  edit Private Group
export async function editPrivateGroup(groupId: string, body: privateGroup, userId: string): Promise<any> {
    try {
        let groupDetails: any = await privateGroupSchema.findById(groupId).exec();
        if (!groupDetails) throw new Error("Group Not Found.");
        if (groupDetails.createdBy != userId) throw new Error("Unautherized Action.");
        if (Array.isArray(body.members) && body.members.length) {
            let removedUsers = groupDetails.members.filter((userId: string) => !body.members.includes(userId))
            let newUsers = body.members.filter((userId: string) => !groupDetails.members.includes(userId))
            body.members = removedUsers.concat(newUsers)
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
        if (group.createdBy._id != userId) throw new Error("Unautherized Action.")
        let data: any = await privateGroupSchema.findByIdAndUpdate(groupId, { $set: { is_active: group.is_active ? false : true } });
        return { message: data.is_active ? RESPONSE.ACTIVE : RESPONSE.INACTIVE };
    } catch (err) {
        throw err;
    };
};

//  Get Group Detail
export async function privateGroupDetails(groupId: string): Promise<any> {
    try {
        let groupDetails: any = await privateGroupSchema.findById(groupId).exec()
        return {
            ...groupDetails,
            createdBy: await userFindOne("id", groupDetails.createdBy, { firstName: 1, middleName: 1, lastName: 1, email: 1 }),
            members: await userFindMany('_id', groupDetails.members, { firstName: 1, lastName: 1, middleName: 1, email: 1 })
        }
    } catch (err) {
        throw err;
    };
};

//  Get Group Detail
export async function privateGroupList(userId: string, search?: string): Promise<any[]> {
    try {
        let searchQuery = search ? { name: new RegExp(search, "i"), createdBy: userId } : { createdBy: userId }
        let groupList = await privateGroupSchema.find({ ...searchQuery }).exec()
        return await Promise.all(groupList.map((group: any) => {
            return {
                ...group,
                createdBy: userFindOne("id", group.createdBy, { firstName: 1, middleName: 1, lastName: 1, email: 1 }),
                members: userFindMany('_id', group.members, { firstName: 1, lastName: 1, middleName: 1, email: 1 })
            }
        }))
    } catch (err) {
        throw err;
    };
};