import { MISSING, GLOBAL_SCOPE } from "../utils/error_msg";
import { roles } from "./role_model";

// Add Role
export async function add_role(objBody: any) {
    try {
        const { role, scope, description } = objBody
        if (!role || !scope) {
            throw new Error(MISSING);
        };
        let success = await roles.create({ role: role, scope: scope, description: description });
        return { status: true, data: success };
    } catch (err) {
        console.log(err);
        throw err;
    };
};

// Get Roles List
export async function role_list() {
    try {
        let success = await roles.find({ is_active: true }, { role: 1, scope: 1 });
        return { status: true, data: success };
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  Edit Role
export async function role_edit(id: any, objBody: any) {
    try {
        let obj: any = {};
        if (objBody.role) {
            obj.role = objBody.role;
        };
        if (objBody.scope) {
            obj.scope = objBody.scope
        };
        if (objBody.description) {
            obj.description = objBody.description
        };
        let data = await roles.findByIdAndUpdate(id, obj, { new: true });
        return { status: true, data: data };
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  Change Role Status
export async function role_status(id: any) {
    try {
        if(!id) throw new Error(MISSING) 
        let role_data: any = await roles.findById(id)
        if (!role_data) throw new Error("Role not Exist");
        let data = await roles.findByIdAndUpdate(id, { is_active: role_data.is_active == true ? false : true })
        return { status: true, data: data }
    } catch (err) {
        console.log(err);
        throw err;
    }
}