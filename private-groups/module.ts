import { privateGroupSchema } from "./model";
import { RESPONSE, DOCUMENT_ROUTER, PRIVATE_MEMBER } from "../utils/error_msg";
import { userFindMany, userFindOne } from "../utils/users";
import { checkRoleScope } from "../utils/role_management";
import { APIError } from "../utils/custom-error";
import { userRoleAndScope } from "../role/module";
import { getConstantsAndValues } from "../site-constants/module";

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
        if (!isEligible) throw new APIError(PRIVATE_MEMBER.CREATE.NO_ACCESS, 403);
        if (!body.name || body.name.trim() == "" || !Array.isArray(body.members) || !body.members.length) throw new Error(PRIVATE_MEMBER.CREATE.MISSING_FIELDS);
        if (body.name && (/[ ]{2,}/.test(body.name) || !/[A-Za-z0-9  -]+$/.test(body.name))) throw new Error(PRIVATE_MEMBER.CREATE.INVALID_NAME)
        // await validatePrivateMembersConstants(body);
        if (body.members.includes(userObj._id)) throw new Error(PRIVATE_MEMBER.CREATE.OWNER_NOT_PRIVATE_MEMBER)
        let existGroups = await privateGroupSchema.find({ name: body.name, createdBy: userObj._id, is_active: true })
        if (existGroups.length) throw new Error(PRIVATE_MEMBER.CREATE.GROUP_NAME_EXIST)
        return privateGroupSchema.create({ ...body, createdBy: userObj._id })
    } catch (err) {
        throw err
    };
};

//  edit Private Group
export async function editPrivateGroup(groupId: string, body: any, userId: string): Promise<any> {
    try {
        let groupDetails: any = await privateGroupSchema.findById(groupId).exec();
        if (!groupDetails) throw new Error(PRIVATE_MEMBER.EDIT.GROUP_NOT_FOUND);
        if (groupDetails.createdBy != userId) throw new Error(PRIVATE_MEMBER.EDIT.NO_ACCESS);
        if (body.members && (!Array.isArray(body.members) || !body.members.length)) throw new Error(PRIVATE_MEMBER.EDIT.MINIMUM_ONE_USER_REQUIRED);
        if (body.name && (/[ ]{2,}/.test(body.name) || !/[A-Za-z0-9  -]+$/.test(body.name))) throw new Error(PRIVATE_MEMBER.EDIT.INVALID_NAME)
        // await validatePrivateMembersConstants(body);
        if (body)
            if (body.members) {
                let existUsersRemoved = body.members.filter((user: any) => !groupDetails.members.includes(user))
                if (!existUsersRemoved.length) throw new Error(PRIVATE_MEMBER.EDIT.ALREADY_MEMBER)
                body.members = [...new Set(groupDetails.members.concat(body.members))]
                if (body.members.includes(userId)) throw new Error(PRIVATE_MEMBER.EDIT.OWNER_NOT_PRIVATE_MEMBER)
            }
        return await privateGroupSchema.findByIdAndUpdate(groupId, { $set: { ...body } })
    } catch (err) {
        throw err
    };
};

//  edit Private Group
export async function removePrivateGroup(groupId: string, body: privateGroup, userId: string): Promise<any> {
    try {
        let groupDetails: any = await privateGroupSchema.findById(groupId).exec();
        if (!groupDetails) throw new Error(PRIVATE_MEMBER.REMOVE.GROUP_NOT_FOUND);
        if (groupDetails.createdBy != userId) throw new Error(PRIVATE_MEMBER.REMOVE.NO_ACCESS);
        if (Array.isArray(body.members) && body.members.length) {
            body.members = groupDetails.members.filter((userId: string) => !body.members.includes(userId))
        }
        if (groupDetails.members.length == 1) throw new Error(PRIVATE_MEMBER.REMOVE.MINIMUM_ONE_USER_REQUIRED)
        return await privateGroupSchema.findByIdAndUpdate(groupId, { $set: { ...body } })
    } catch (err) {
        throw err
    };
};

//  change private Group status
export async function privateGroupStatus(groupId: string, userId: string): Promise<any> {
    try {
        let group: any = await privateGroupSchema.findById(groupId).exec();
        if (!group) throw new Error(PRIVATE_MEMBER.STATUS.GROUP_NOT_FOUND);
        if (group.createdBy != userId) throw new Error(PRIVATE_MEMBER.STATUS.NO_ACCESS)
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
        let userData = await userFindMany('_id', group.members.concat([group.createdBy]), { firstName: 1, lastName: 1, middleName: 1, email: 1, phone: 1, is_active: 1 })
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
    return {
        ...userData,
        role: ((await userRoleAndScope(userData._id) as any).data || [""])[0]
    };
};

async function validatePrivateMembersConstants(body: any) {
    try {
        let { docNamePg, docDescriptionPg }: any = await getConstantsAndValues(["docNamePg", "docDescriptionPg"])
        if (body.name > Number(docNamePg)) {
            throw new Error(`Private members name should not exceed more than ${docNamePg} characters`);
        }
        if (body.description > Number(docDescriptionPg)) {
            throw new Error(`Private members description should not exceed more than ${docDescriptionPg} characters`);
        }
    }
    catch (err) {
        throw err
    }
}