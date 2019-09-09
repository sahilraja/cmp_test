import * as request from "request-promise";
import { Users } from "../users/model";

// Get Roles List
export async function role_list() {
    try {
        let Options = {
            uri: `${process.env.RBAC_URL}/capabilities/policy/list`,
            method: "GET",
            json: true
        }
        let data = await request(Options);
        if (!data.status) throw new Error("Error to fetch Roles")
        let role: any[] = []
        let roleList: any = []
        await data.data.map((obj: any) => {
            if (!role.includes(obj[0])) {
                role.push(obj[0])
                let scope = (obj[1].indexOf("/") == -1) ? obj[1] : obj[1].substring(0, obj[1].indexOf("/"))
                roleList.push({ role: obj[0], scope: scope })
            };
        });
        return { roles: roleList }
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  Check Role Scope
export async function checkRoleScope(role: any, scope: any) {
    try {
        let Options = {
            uri: `${process.env.RBAC_URL}/capabilities/policy/list`,
            method: "GET",
            json: true
        }
        let data = await request(Options);
        if (!data.status) throw new Error("Error to fetch Roles")
        for (const policy of data.data) {
            if (policy[0].includes(role) && policy[1].includes(scope)) {
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
            uri: `${process.env.RBAC_URL}/role/list/${userId}`,
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
            uri: `${process.env.RBAC_URL}/role/user/list`,
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
