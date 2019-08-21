import { MISSING, GLOBAL_SCOPE } from "../utils/error_msg";
import { casbin_policy } from "../utils/casbinDB_adapter";
import { roles } from "./role_model";

//  add capability for a role
export async function add_capability(objBody: any) {
    try {
        if (!objBody.role || !objBody.capability || !objBody.action) {
            throw new Error(MISSING);
        };
        if (!objBody.scope) {
            objBody.scope = GLOBAL_SCOPE;
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
            throw new Error(MISSING);
        };
        if (!objBody.scope) {
            objBody.scope = GLOBAL_SCOPE;
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
            objQuery.scope = GLOBAL_SCOPE;
        };
        let policy = await casbin_policy();
        let data = await policy.getFilteredPolicy(0, objQuery.scope)
        return { status: true, data: data };
    } catch (err) {
        console.log(err);
        throw err;
    }
};

// add role 
export async function add_role(objBody: any) {
    try {
        if (!objBody.role || !objBody.description) {
            throw new Error(MISSING);
        };
        let data = await roles.create({ role: objBody.role, description: objBody.description });
        return { status: true, data: data };
    } catch (err) {
        console.log(err);
        throw err;
    };
};

// get role list
export async function role_list() {
    try {
        let data = await roles.find({ is_active: true });
        return { status: true, data: data };

    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  edit role
export async function role_edit(id: any, objBody: any) {
    try {
        let obj: any = {};
        if (objBody.role) {
            obj.role = objBody.role;
        };
        if (objBody.description) {
            obj.description = objBody.description
        }
        let data = await roles.findByIdAndUpdate(id, obj, { new: true })
        return { status: true, data: data };

    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  change role status
export async function role_status(id: any) {
    try {
        let role_data: any = await roles.findById(id)
        if (!role_data) throw new Error("Role not Exist");
        let data = await roles.findByIdAndUpdate(id, { is_active: role_data.is_active == true ? false : true })
        return { status: true, data: data }
    } catch (err) {
        console.log(err);
        throw err;
    }
}