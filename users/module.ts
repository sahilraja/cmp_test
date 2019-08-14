import { missing } from "../utils/Const";
import { casbin_policy } from "../utils/casbinDB_adapter";

//  add role to thr user
export async function add_role(userId: any, objbody: any) {
    try {
        if (!userId || !objbody.scope || !objbody.role) {
            throw new Error(missing);
        };
        let policy: any = await casbin_policy();
        await policy.LoadPolicy();
        let data = await policy.AddRoleForUser(userId, objbody.scope, objbody.role);
        await policy.SavePolicy();
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
        let policy: any = await casbin_policy();
        await policy.LoadPolicy();
        let data = await policy.deleteRoleForUser(userId, objbody.scope, objbody.role);
        await policy.SavePolicy();
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  get role of the user
export async function get_roles(userId: any) {
    try {
        if (!userId) {
            throw new Error(missing);
        };
        let policy: any = await casbin_policy();
        await policy.LoadPolicy();
        let data = await policy.GetRolesForUser(userId);
        await policy.SavePolicy();
    } catch (err) {
        console.log(err);
        throw err;
    };
};
