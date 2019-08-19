import { missing } from "../utils/Const";
import { casbin_policy } from "../utils/casbinDB_adapter";
import { Users } from "./model";
import { nodemail } from "../utils/email";

//  add role to thr user
export async function add_role(userId: any, objbody: any) {
    try {
        if (!userId || !objbody.scope || !objbody.role) {
            throw new Error(missing);
        };
        let policy = await casbin_policy();
        await policy.loadPolicy();
        let data = await policy.addRoleForUser(userId, objbody.scope, objbody.role);
        if (data == false) throw new Error("Role Exist")
        await policy.savePolicy();
        return { status: true, data: [userId, objbody.scope, objbody.role] }
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  revoke role to the user
export async function revoke_role(userId: any, objbody: any) {
    try {
        if (!userId || !objbody.scope || !objbody.role) {
            throw new Error(missing);
        };
        let policy = await casbin_policy();
        await policy.loadPolicy();
        let data = await policy.deleteRoleForUser(userId, objbody.scope, objbody.role);
        if (data == false) throw new Error("Role not Exist")
        await policy.savePolicy();
        return { status: true, data: [userId, objbody.scope, objbody.role] }
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  get role of the user
export async function get_roles(userId: any, objQuery: any) {
    try {
        if (!userId) {
            throw new Error(missing);
        };
        let policy = await casbin_policy();
        // await policy.loadModel();
        let data
        if (objQuery.project) {
            data = await policy.getRolesForUser(userId, objQuery.project);
        } else {
            data = await policy.getRolesForUser(userId);
        }
        return { status: true, data: data }
    } catch (err) {
        console.log(err);
        throw err;
    };
};

export async function invite_user(objBody: any) {
    try {
        if (!objBody.role || !objBody.email || !objBody.username) {
            throw new Error(missing);
        }
        let userData = await Users.create({ username: objBody.username, email: objBody.email, role: objBody.role })
        let email = await nodemail({
            email: objBody.email,
            subject: "cmp invite user",
            text: `hi ${objBody.username}\n you are invited for this role ${objBody.role}\n <a href="https://google.com">click here</a> and proceed your registration`
        })
        return { status: true, data: userData }

    } catch (err) {
        console.log(err)
        throw err;

    }
};

//  get user list
export async function edit_user(objBody: any) {
    try {
        let obj: any = {}
        if (objBody.role) {
            obj.role = objBody.role
        };
        if (objBody.email) {
            obj.email = objBody.email
        };
        if (objBody.username) {
            obj.username = objBody.username
        };
        let data = await Users.updataOne(obj, {new: true})
        return { status: true, data: data }
    } catch (err) {
        console.log(err);
        throw err;
    }
};

// edit user
export async function user_list() {
    try {
        let data = await Users({}, { username: 1, role: 1, email: 1 }).exec()
        return { status: true, data: data }
    } catch (err) {
        console.log(err);
        throw err;
    }
}
