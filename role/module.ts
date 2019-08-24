import * as request from "request-promise";

// Get Roles List
export async function role_list(objQuery: any) {
    try {
        const { role, capabilities } = objQuery
        let Options = {
            uri: `${process.env.RBAC_URL}/capabilities/list`,
            method: "GET",
            json: true
        }
        let data = await request(Options);
        if (!data.status) throw new Error("Error to fetch Roles")
        let allroles: any[] | undefined
        if (role) {
            allroles = data.data.map((obj: any) => obj[0]);
        } else if (!role && capabilities) {
            allroles = data.data.map((obj: any) => obj[2]);
        }
        
        let roles = [...new Set(allroles)]
        return { status: true, data: roles }
    } catch (err) {
        console.log(err);
        throw err;
    };
};

export async function checkRoleScope(role: any, scope: any) {
    try {
        let Options = {
            uri: `${process.env.RBAC_URL}/capabilities/list`,
            method: "GET",
            json: true
        }
        let data = await request(Options);
        if (!data.status) throw new Error("Error to fetch Roles")
        data.data.map((obj: any) => {
            if (role && obj[1].includes(scope)) {
                return true
            }
        });
        return false
    } catch (err) {
        console.log(err);
        throw err
    }
}

e