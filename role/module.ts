import { MISSING, GLOBAL_SCOPE } from "../utils/error_msg";
import { roles } from "./role_model";

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