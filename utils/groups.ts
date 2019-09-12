import * as request from "request-promise";
import { addCollaborator } from "../documents/module";

enum roleHierarchy {
    owner = 0,
    collaborator = 1,
    viewer = 2
};

// Add Policies for Documents
export async function groupsAddPolicy(userId: string, docId: string, role: string) {
    try {
        let Options = {
            uri: `${process.env.GROUPS_URL}/document/user/add`,
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
            uri: `${process.env.GROUPS_URL}/document/user/remove`,
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
            uri: `${process.env.GROUPS_URL}/policy/filter`,
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

export async function GetDocIdsForUser(userId: string) {
    try {
        let policies = await groupsPolicyFilter(`user/${userId}`, 0, "p")
        if (!policies.data) throw new Error("policies not found for this User.")
        let users = policies.data.map((key: string[]) => key[1].substring(key[1].indexOf("/") + 1))
        return [...new Set(users)]
    } catch (err) {
        throw err;
    };
};

export async function getRoleOfDoc(userId: string, docId: string) {
    try {
        let policies = await groupsPolicyFilter(`user/${userId}`, 0, "p")
        if (!policies.data) throw new Error("policies not found for this User.");
        policies.data.map((key: string[]) => {
            if (key[1].includes(docId) && ["owner", "collaborator", "viewer"].includes(key[2]))
                return key
        })
    } catch (err) {
        throw err;
    };
};

export async function shareDoc(userId: string, type: string, docId: string, role: any) {
    try {
        let userRole: any = await getRoleOfDoc(`${type}/${userId}`, docId)
        if (Array.isArray(userId) && roleHierarchy[userRole[2]] > roleHierarchy[role]) {
            await groupsRemovePolicy(`${type}/${userId}`, docId, userRole[2])
            return await groupsAddPolicy(`${type}/${userId}`, docId, role)
        }
        if (!userRole) {
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
        let users = policies.data.map((key: any) => key[0])
        return [...new Set(users)]
    } catch (err) {
        throw err;
    };
};

export async function GetDocCapabilitiesForUser(userId: string, docId: string) {
    try {
        let policies = await groupsPolicyFilter(`user/${userId}`, 0, "p")
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
