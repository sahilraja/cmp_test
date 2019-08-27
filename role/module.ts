import * as request from "request-promise";

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
        let data: any = []
        let object: any = {}
        success.data.map((key: any) => {
            if (object.role && object.role != key.role) {
                data.push(object)
                object = {}
            }
            if (object.role == key.role && key.scope != "global") {
                object.scope.push(key.scope.substring(key.scope.indexOf("/") + 1, key.scope.length))
            }
            if (!object.role) {
                object.role = key.role
                object.scope = key.scope == "global" ? "global" : [key.scope.substring(key.scope.indexOf("/") + 1, key.scope.length)]
            }
        })
        if (!data.length) data.push(object)
        return { data: data }
    } catch (err) {
        console.log(err)
        throw err
    }
}
