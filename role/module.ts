import * as request from "request-promise";
import { RBAC_URL } from "../utils/urls";
import * as fs from "fs";
import { join } from "path";
import { userList } from "../utils/users";

// Get Roles List
export async function role_list() {
    let roles: Array<any> = JSON.parse(fs.readFileSync(join(__dirname, "..", "utils", "rbac.json"), "utf8"));
    return roles.map(role => {
        return { role: role.role, description: role.description, category: role.category }
    });
};

export async function roles_list() {
    let roles: Array<any> = JSON.parse(fs.readFileSync(join(__dirname, "..", "utils", "roles.json"), "utf8"));
    let listOfRoles = roles.map(role => {
        return { role: role.role, description: role.description, category: role.category }
    });
    return {
        status: true,
        roles:listOfRoles
    }
};
export async function capabilities_list() {
    let capabilities: Array<any> = JSON.parse(fs.readFileSync(join(__dirname, "..", "utils", "capabilities.json"), "utf8"));
    let listcapabilities= capabilities.map(capability => {
        return { capability: capability.capability, description: capability.description, scope: capability.scope }
    });
    return {
        status: true,
        roles:listcapabilities
    }
};
//  Check Role Scope
export async function checkRoleScope(role: any, capabilities: any) {
    try {
        let Options = {
            uri: `${RBAC_URL}/capabilities/policy/list`,
            method: "GET",
            json: true
        }
        let data = await request(Options);
        if (!data.status) throw new Error("Error to fetch Roles")
        for (const policy of data.data) {
            if (policy[0].includes(role) && policy[2].includes(capabilities)) {
                return true
            }
        }
        return false
    } catch (err) {
        console.log(err);
        throw err
    }
}

export async function userRoleAndScope(userId: any) {
    try {
        let Options = {
            uri: `${RBAC_URL}/role/list/${userId}`,
            method: "GET",
            json: true
        }
        let success = await request(Options);
        if (!success.status) throw new Error("Fail to get Roles.")
        let object: any = {}
        success.data.map((key: any) => {
            if (object[key.role]) {
                object[key.role].push(key.scope)
            } else {
                if (key.scope == "global") {
                    object[key.scope] = [key.role]
                } else {
                    object[key.role] = [key.scope]
                }
            }
        });
        return { data: object }
    } catch (err) {
        console.log(err)
        throw err
    }
}

export async function usersForRole(role: string) {
    try {
        if (!role) throw new Error("Missing Role.");
        let Options = {
            uri: `${RBAC_URL}/role/user/list`,
            method: "GET",
            qs: {
                role: role,
            },
            json: true
        }
        let success = await request(Options);
        if (!success) throw new Error("Fail to get users.")
        let users = await userList({ _id: { $in: success.users } }, { name: 1 })
        return { role: role, users: users }
    } catch (err) {
        console.log(err);
        throw err;
    };
};

export async function capabilities() {
    try {
        let Options = {
            uri: `${RBAC_URL}/capabilities/list`,
            method: "GET",
            json: true
        }
        let data = await request(Options);
        if (!data.status) throw new Error("Error to fetch Roles")
        return data
    } catch (err) {
        console.log(err);
        throw err
    }
}

export async function allrolecapabilities() {
    try {
        let Options = {
            uri: `${RBAC_URL}/role/all/capabilities/list`,
            method: "GET",
            json: true
        }
        let data = await request(Options);
        if (!data.status) throw new Error("Error to fetch Roles")
        return data
    } catch (err) {
        console.log(err);
        throw err
    }
}

export async function addCapability(role: string, scope: string, capability: string) {
    try {
        let Options = {
            uri: `${RBAC_URL}/capabilities/add`,
            method: "POST",
            body: {
                "role": role,
                "scope": scope,
                "capability": capability
            },
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err;
    };
};

export async function removeCapability(role: string, scope: string, capability: string) {
    try {
        let Options = {
            uri: `${RBAC_URL}/capabilities/remove`,
            method: "PUT",
            body: {
                "role": role,
                "scope": scope,
                "capability": capability
            },
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err;
    };
};
export async function updaterole(role: string, description: string) {
    try {
        
        let data = await roles_list()
        if (!data) throw new Error("Error to fetch Roles")

        return data
    } catch (err) {
        console.log(err);
        throw err
    }
}