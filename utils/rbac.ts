import * as request from "request-promise";
import { RBAC_URL } from "./urls";

//  Add Roles In Rbac
export async function addRole(userId: string, role: any, scope: any = "global") {
    try {
        let Options = {
            uri: `${RBAC_URL}/role/add/${userId}`,
            method: "POST",
            body: {
                "role": role,
                "scope": scope
            },
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err;
    };
};

export async function updateRole(userId: string, updateRole: string, deleteRole: string, scope: any = "global") {
    try {
        let Options = {
            uri: `${RBAC_URL}/role/update/${userId}`,
            method: "POST",
            body: {
                "updateRole": updateRole,
                "scope": scope,
                "deleteRole" :deleteRole
            },
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err;
    };
};

//  Get Roles Of User
export async function getRoles(userId: string) {
    try {
        let Options = {
            uri: `${RBAC_URL}/role/list/${userId}`,
            method: "GET",
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err
    };
};

//  Get Role Capabilities
export async function roleCapabilitylist(role: string) {
    try {
        let Options = {
            uri: `${RBAC_URL}/role/capabilities/list`,
            method: "GET",
            qs: {
                role: role
            },
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err
    };
};

//  Check Capabilities
export async function checkCapability(object: any) {
    try {
        const { role, scope, capability } = object
        let Options = {
            uri: `${RBAC_URL}/capabilities/check`,
            method: "GET",
            qs: {
                role: role,
                scope: scope,
                capability: capability
            },
            json: true
        }
        return await request(Options);
    } catch (err) {
        console.error(err);
        throw err;
    };
};
