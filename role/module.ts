import { missing, global_scope } from "../utils/Const";
import { casbin_policy } from "../utils/casbinDB_adapter";

//  add capability for a role
export async function add_capability(objBody: any) {
    try {
        if (!objBody.role || !objBody.capability || !objBody.action) {
            throw new Error(missing);
        };
        if (!objBody.scope) {
            objBody.scope = global_scope;
        };
        const p = [objBody.scope, objBody.role, objBody.capability, objBody.action]
        let policy = await casbin_policy();
        await policy.loadPolicy();
        let data = await policy.addPolicy(...p);
        await policy.savePolicy();
        return { status: true, data: p };
    } catch (err) {
        console.log(err);
        throw err;
    }
}

//  remove capability for role
export async function remove_capability(objBody: any) {
    try {
        if (!objBody.role || !objBody.capability || !objBody.action) {
            throw new Error(missing);
        };
        if (!objBody.scope) {
            objBody.scope = global_scope;
        };
        const p = [objBody.scope, objBody.role, objBody.capability, objBody.action]
        let policy = await casbin_policy();
        await policy.loadPolicy();
        let data = await policy.removePolicy(...p);
        await policy.savePolicy();
        return { status: true, data: p };
    } catch (err) {
        console.log(err);
        throw err;
    }
};

//  scope capability list
export async function scope_capability_list(objQuery: any) {
    try {
        if (!objQuery.scope) {
            objQuery.scope = global_scope;
        };
        let policy = await casbin_policy();
        let data = await policy.getFilteredPolicy(0, objQuery.scope)
        return { status: true, data: data };
    } catch (err) {
        console.log(err);
        throw err;
    }
};

