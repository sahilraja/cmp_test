import { MISSING } from "../utils/error_msg";
import { Users } from "./model";
import { nodemail } from "../utils/email";
import { invite_user_form } from "../utils/email_template";
import { roles } from "../role/role_model";
import { jwt_create, jwt_Verify } from "../utils/utils";

//  invite user
export async function invite_user(objBody: any) {
    try {
        if (!objBody.role || !objBody.email || !objBody.username) {
            throw new Error(MISSING);
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

//  user login
export async function user_login(objBody: any) {
    try {
        if (!objBody.email || !objBody.password) {
            throw Error("Missing fields.");
        }
        if ((typeof objBody.email !== "string") || (typeof objBody.password !== "string")) {
            throw Error("Invalid fields.");
        }
        let user_data: any = await Users.findOne({ email: objBody.email });
        if (!user_data) throw new Error("Invalid User");
        let result: any = await user_data.comparePassword(objBody.password);
        if (!result) {
            throw Error("Invalid login details.");
        }
        let token = await jwt_create(user_data.id)
        return { status: true, data: token };
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  resend invite link
export async function user_invite_resend(id: any) {
    try {
        if (!id) throw new Error(MISSING)
        let user_data: any = await Users.findById(id)
        let email = await nodemail({
            email: user_data.email,
            subject: "cmp invite user",
            html: invite_user_form({
                username: user_data.username,
                role: user_data.role,
                link: `www.google.com`
            })
        })
        return { status: true, data: "email send successfully" }
    } catch (err) {
        console.log(err);
        throw err;
    };
};

// validate invite link
export async function validate_link(token: any) {
    try {
        if (!token) throw new Error(MISSING);
        let token_data: any = await jwt_Verify(token)
        if (!token_data) throw new Error("Invalid Token.");
        let user_data = await Users.findById(token_data.id);
        return { status: true, data: user_data };
    } catch (err) {
        console.log(err);
        throw err
    };
};

// user register
export async function user_register(id: any, objBody: any) {
    try {
    if(!id || !objBody.username || !objBody.phone || !objBody.upload_photo || !objBody.aboutme || !objBody.password){
        throw new Error(MISSING);
    }
    
    } catch (err) {
        console.log(err);
        throw err;
    }
}
