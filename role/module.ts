import * as request from "request-promise";
import { Users } from "../users/model";
import { RBAC_URL } from "../utils/urls";
import * as fs from "fs";
import { join } from "path";

// Get Roles List
export async function role_list() {
    let roles : Array<any> = JSON.parse(fs.readFileSync(join(__dirname, "..", "utils", "rbac.json"), "utf8"));
    return roles.map(role => {
        return { role : role.role, description: role.description, category: role.category }
    });
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
        let users = await Users.find({ _id: { $in: success.users } }, { firstName: 1, secondName: 1 })
        return { role: role, users: users }
    } catch (err) {
        console.log(err);
        throw err;
    };
};
