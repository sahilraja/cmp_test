import { MISSING } from "../utils/error_msg";
import { Users } from "./model";
import { nodemail } from "../utils/email";
import { invite_user_form } from "../utils/email_template";
import { jwt_create, jwt_Verify, jwt_for_url } from "../utils/utils";
import { checkRoleScope } from "../role/module";
import * as request from "request-promise";


//  Create User
export async function inviteUser(objBody: any, user: any) {
    try {
        if (!objBody.email || !objBody.name) {
            throw new Error(MISSING);
        };
        let admin_scope = await checkRoleScope(user.role, "global");
        if (!admin_scope) throw new Error("invalid user");
        let userData: any = await Users.create({
            firstName: objBody.name.split(' ').slice(0, -1).join(' '),
            secondName: objBody.name.split(' ').slice(-1).join(' '),
            email: objBody.email,
            role: objBody.role
        });
        let token = await jwt_for_url({
            firstName: userData.firstName,
            secondName: userData.secondName,
            email: userData.email,
            role: userData.role
        });
        let success = await nodemail({
            email: objBody.email,
            subject: "cmp invite user",
            html: invite_user_form({
                username: objBody.username,
                role: objBody.role,
                link: `${process.env.ANGULAR_URL}/invite/user/:${token}`
            })
        })
        return { userId: userData.id };
    } catch (err) {
        console.log(err)
        throw err;
    };
};

//  Add projects to that role
export async function addRolesToUser(userId: any, role: any, projects: any) {
    try {
        if (!userId || !projects) {
            throw new Error(MISSING);
        };
        let user_scope = await checkRoleScope(role, "global");
        if (user_scope) throw new Error("global scope doesn't need projects");

        for (const project of projects) {
            let Options = {
                uri: `${process.env.RBAC_URL}/role/add/${userId}`,
                method: "POST",
                body: {
                    "role": role,
                    "scope": `projects/${project}`
                },
                json: true
            }
            let success = await request(Options);
            if (!success.status) throw new Error("fail to create role");
        }
        return { success: true, data: "Roles added successfully" };
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  Edit user
export async function edit_user_by_admin(id: any, objBody: any) {
    try {
        let obj: any = {}
        if (objBody.role) {
            obj.role = objBody.role
        };
        if (objBody.email) {
            obj.email = objBody.email
            obj.emailVerified = false
        };
        if (objBody.username) {
            obj.username = objBody.username
        };
        // if()
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

//  Resend invite link
export async function userInviteResend(id: any, role: any) {
    try {
        if (!id) throw new Error(MISSING)
        let userData: any = await Users.findById(id)
        if (!userData.emailVerified) throw new Error("Email Already Verified")
        let token = await jwt_for_url({ user: id, role: role });
        let success = await nodemail({
            email: userData.email,
            subject: "cmp invite user",
            html: invite_user_form({
                username: userData.username,
                role: role,
                link: `${process.env.ANGULAR_URL}/invite/user/:${token}`
            })
        })
        return { status: true, data: "email send successfully" }
    } catch (err) {
        console.log(err);
        throw err;
    };
};

// Validate invite link
export async function validLink(token: any) {
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
        if (!id || !objBody.username || !objBody.phone || !objBody.upload_photo || !objBody.aboutme || !objBody.password) {
            throw new Error(MISSING);
        }

    } catch (err) {
        console.log(err);
        throw err;
    }
}
