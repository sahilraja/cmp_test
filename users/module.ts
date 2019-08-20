import { missing } from "../utils/Const";
import { casbin_policy } from "../utils/casbinDB_adapter";
import { Users } from "./model";
import { nodemail } from "../utils/email";
import { invite_user_form } from "../utils/email_template";
import { roles } from "../role/role_model";

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
        await policy.loadModel();
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
        let userrole: any = await roles.findById(objBody.role)
        let email = await nodemail({
            email: objBody.email,
            subject: "cmp invite user",
            html: invite_user_form({
                username: objBody.username,
                role: userrole.role,
                link: `www.google.com`
            })
        })
        return { status: true, data: userData }

    } catch (err) {
        console.log(err)
        throw err;

    }
};

//  get user list
export async function edit_user_by_admin(id: any, objBody: any) {
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
        let data = await Users.findByIdAndUpdate(id, obj, { new: true })
        return { status: true, data: data }
    } catch (err) {
        console.log(err);
        throw err;
    }
};

// edit user
export async function user_list(query: any, page = 1, limit: any = 100, sort = "createdAt", ascending = false) {
    try {
        let findQuery = { is_active: true }
        let check: any = {};
        check[sort] = ascending ? 1 : -1;
        let data = await Users.paginate(findQuery, { select: { username: 1, role: 1, }, page: page, limit: parseInt(limit), sort: check })
        return { status: true, data: data }
    } catch (err) {
        console.log(err);
        throw err;
    }
};

//  status user
export async function user_status(id: any) {
    try {
        let user_data: any = await Users.findById(id)
        if (!user_data) throw new Error("User Not exist");
        let data = await Users.findByIdAndUpdate(id, { is_active: user_data.is_active == true ? false : true }, { new: true })
        return { status: true, data: data }
    } catch (err) {
        console.log(err)
        throw err;
    }
};

// export async function user_login(objBody) {
//     try {
//         if(!objBody.phone || )
//     } catch (err) {
//         console.log(err);
//         throw err;
//     }
// }