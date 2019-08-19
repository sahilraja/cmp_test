import { missing } from "../utils/Const";
import { casbin_policy } from "../utils/casbinDB_adapter";

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
