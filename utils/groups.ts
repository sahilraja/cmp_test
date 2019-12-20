import * as request from "request-promise";
import { GROUPS_URL } from "./urls";
import { promises } from "fs";
import { groupFindOne } from "./users";

export enum roleHierarchy {
    owner = 0,
    collaborator = 1,
    viewer = 2
};

// Add Policies for Documents
export async function groupsAddPolicy(userId: string, docId: string, role: string) {
    try {
        let Options = {
            uri: `${GROUPS_URL}/document/user/add`,
            method: "POST",
            body: {
                userId: userId,
                docId: docId,
                role: role
            },
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err;
    };
};


// Add Policies for Documents
export async function groupsRemovePolicy(userId: string, docId: string, role: string) {
    try {
        let Options = {
            uri: `${GROUPS_URL}/document/user/remove`,
            method: "POST",
            body: {
                userId: userId,
                docId: docId,
                role: role
            },
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err;
    };
};

// Add Policies for Documents
export async function groupsPolicyFilter(userId: string, filter: number = 0, policy: string = "p") {
    try {
        let Options = {
            uri: `${GROUPS_URL}/policy/filter`,
            method: "GET",
            qs: {
                userId: userId,
                filter: filter,
                policy: policy
            },
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err;
    };
};


export async function GetUserIdsForDocWithRole(docId: string, role: string) {
    try {
        let policies = await groupsPolicyFilter(`document/${docId}`, 1, "p")
        if (!policies.data) throw new Error("policies not found for this document.")
        let users = policies.data.filter((policy: string[]) => {
            if (policy[2] == role)
                return policy[0]
        }).map((key: any) => key[0])
        return [...new Set(users)]
    } catch (err) {
        throw err;
    };
};

export async function GetDocIdsForUser(userId: string, type?:string, docRole?: string[]): Promise<any[]> {
    try {
        let userType = type || "user"
        let docRoles = docRole || ["collaborator", "viewer"] 
        if(userType == "group"){
            let group: any = await groupFindOne("id", userId);
            if(!group || !group.is_active) return []
        }
        let policies = await groupsPolicyFilter(`${userType}/${userId}`, 0, "p")
        let users = policies.data.filter((policy: string[]) => {
            if (docRoles.includes(policy[2]))
                return policy
        }).map((key: string[]) => key[1].substring(key[1].indexOf("/") + 1))
        return [...new Set(users)]
    } catch (err) {
        throw err;
    };
};


// get Role of Doc in return Array[2] 
export async function getRoleOfDoc(userId: string, docId: string, type?: string): Promise<string> {
    try {
        let userType = type || "user"
        let { data: policies } = await groupsPolicyFilter(`${userType}/${userId}`, 0, "p")
        let data = policies.filter((key: string[]) => {
            if (key[1].includes(docId) && ["owner", "collaborator", "viewer"].includes(key[2]))
                return key
        })
        return data[0]
    } catch (err) {
        throw err;
    };
};

export async function shareDoc(userId: string, type: string, docId: string, role: any) {
    try {
        let userRole: any = await getRoleOfDoc(userId, docId, type)
        if (!userRole) {
            return await groupsAddPolicy(`${type}/${userId}`, docId, role)
        }
        if (userId && roleHierarchy[userRole[2]] > roleHierarchy[role]) {
            await groupsRemovePolicy(`${type}/${userId}`, docId, userRole[2])
            return await groupsAddPolicy(`${type}/${userId}`, docId, role)
        }
    } catch (err) {
        throw err
    };
};

export async function GetUserIdsForDoc(docId: string) {
    try {
        let policies = await groupsPolicyFilter(`document/${docId}`, 1, "p")
        if (!policies.data) throw new Error("policies not found for this document.")
        let users = (policies.data || []).map((key: any) => key[0])
        return [...new Set(users)]
    } catch (err) {
        throw err;
    };
};

export async function GetDocCapabilitiesForUser(userId: string, docId: string, type?: string) {
    try {
        let userType = type || "user"
        let policies = await groupsPolicyFilter(`${userType}/${userId}`, 0, "p")
        if (!policies.data) throw new Error("policies not found for this User.")
        let capability = policies.data.filter((policy: string[]) => {
            if (policy[1].includes(docId))
                return policy
        }).map((key: any) => key[2])
        return [...new Set(capability)]
    } catch (err) {
        throw err;
    };
};


// Get user exist in group ids
export async function userGroupsList(userId: string): Promise<string[]> {
    try {
        let Options = {
            uri: `${GROUPS_URL}/group/list/${userId}`,
            method: "GET",
            json: true
        }
        return (await request(Options)).groups;
    } catch (err) {
        throw err;
    };
};

// Get group is user ids
export async function groupUserList(groupId: string): Promise<string[]> {
    try {
        let Options = {
            uri: `${GROUPS_URL}/group/user/list/${groupId}`,
            method: "GET",
            json: true
        }
        return (await request(Options) as any).users;
    } catch (err) {
        throw err;
    };
};

//  it will create users by group id in group rbc module
export async function addUserToGroup(userId: string, groupId: string): Promise<string[]> {
    try {
        let Options = {
            uri: `${GROUPS_URL}/group/user/add`,
            method: "POST",
            body: {
                userId: userId,
                groupId: groupId
            },
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err;
    };
};

//  it will remove user by group id in group rbc module
export async function removeUserToGroup(userId: string, groupId: string): Promise<string[]> {
    try {
        let Options = {
            uri: `${GROUPS_URL}/group/user/remove`,
            method: "POST",
            body: {
                userId: userId,
                groupId: groupId
            },
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err;
    };
};

export async function checkCapability(user: string, scope: string, capability: string) {
    try {
        let Options = {
            uri: `${GROUPS_URL}/policy/enforce`,
            method: "GET",
            qs: {
                userId: user,
                scope: scope,
                capability: capability
            },
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err
    };
};

