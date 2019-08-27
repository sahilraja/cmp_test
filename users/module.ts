import { MISSING } from "../utils/error_msg";
import { Users } from "./model";
import { nodemail } from "../utils/email";
import { inviteUserForm, forgotPasswordForm } from "../utils/email_template";
import { jwt_create, jwt_Verify, jwt_for_url, hashPassword, comparePassword } from "../utils/utils";
import { checkRoleScope } from "../role/module";
import * as request from "request-promise";


//  Create User
export async function inviteUser(objBody: any, user: any) {
    try {
        if (!objBody.email || !objBody.name || !objBody.role || !user) {
            throw new Error(MISSING);
        };
        let admin_scope = await checkRoleScope(user.role, "global");
        if (!admin_scope) throw new Error("invalid user");
        let userData: any = await Users.create({
            firstName: objBody.name.split(' ').slice(0, -1).join(' '),
            secondName: objBody.name.split(' ').slice(-1).join(' '),
            email: objBody.email,
        });
        return { userId: userData.id };
    } catch (err) {
        console.log(err)
        throw err;
    };
};

//  Add projects to that role
export async function addRolesToUser(userId: any, role: any, project: any) {
    try {
        if (!userId || !role) {
            throw new Error(MISSING);
        };
        let user_scope = await checkRoleScope(role, "global");
        if (user_scope && project) throw new Error("global scope doesn't need projects");

        let Options = {
            uri: `${process.env.RBAC_URL}/role/list/${userId}`,
            method: "GET",
            json: true
        }
        let success = await request(Options);
        if (!success.status) throw new Error("Fail to get Roles.")

        if (success.data.length) {
            //  remove all role 
            let Options = {
                uri: `${process.env.RBAC_URL}/role/remove/all/${userId}`,
                method: "PUT",
                json: true
            }
            let success = await request(Options);
            if (!success.status) throw new Error("fail to remove all roles");
        }

        if (user_scope) {
            let Options = {
                uri: `${process.env.RBAC_URL}/role/add/${userId}`,
                method: "POST",
                body: {
                    "role": role,
                    "scope": `global`
                },
                json: true
            }
            let success = await request(Options);
            if (!success.status) throw new Error("fail to create role");

        } else {
            //  add all roles
            for (const code of project) {
                let Options = {
                    uri: `${process.env.RBAC_URL}/role/add/${userId}`,
                    method: "POST",
                    body: {
                        "role": role,
                        "scope": `projects/${code}`
                    },
                    json: true
                }
                let success = await request(Options);
                if (!success.status) throw new Error("fail to create role");
            };
        };

        if (!success.data.length) {
            let userDetails: any = await Users.findById(userId)

            let token = await jwt_for_url({
                id: userId,
                firstName: userDetails.firstName,
                secondName: userDetails.secondName,
                email: userDetails.email,
                role: role
            });

            let mailStatus = await nodemail({
                email: userDetails.email,
                subject: "cmp invite user",
                html: inviteUserForm({
                    username: userDetails.firstName + " " + userDetails.secondName,
                    role: role,
                    link: `${process.env.ANGULAR_URL}/user/register/${token}`
                })
            })
        }
        return { message: "Roles added successfully" };
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  Register User
export async function RegisterUser(objBody: any, verifyToken: any, uploadPhoto: any) {
    try {
        if (!verifyToken) {
            throw new Error(MISSING)
        }
        let token: any = await jwt_Verify(verifyToken)
        if (!token) throw new Error("Invalid Token")

        const { name, password, phone, aboutme } = objBody

        if (!name || !password || !phone || !aboutme) {
            throw new Error(MISSING);
        };
        if (!/^(((?=.*[a-z])(?=.*[A-Z]))|((?=.*[a-z])(?=.*[0-9]))|((?=.*[A-Z])(?=.*[0-9])))(?=.{6,})/.test(password)) {
            throw new Error("password must contain at least 1 lowercase, 1 uppercase, 1 numeric, one special character and  eight characters or longer.")
        }

        if (isNaN(phone) || phone.length != 10) {
            throw new Error("Enter Valid Phone Number.")
        }

        let has_Password = await hashPassword(password)

        let success: any = await Users.findByIdAndUpdate(token.id, {
            firstName: name.split(' ').slice(0, -1).join(' '),
            secondName: name.split(' ').slice(-1).join(' '),
            password: has_Password,
            phone: phone,
            aboutme: aboutme,
            emailVerified: true
        }, { new: true });

        let newToken = await jwt_create({ id: success.id, role: token.role });
        if (!newToken) throw new Error("fail to create token")
        return { token: newToken }
    } catch (err) {
        console.log(err);
        throw err;
    }
};

//  Edit user
export async function edit_user(id: any, objBody: any) {
    try {
        let obj: any = {}
        if (objBody.email) {
            obj.email = objBody.email
            obj.emailVerified = false
        };
        if (objBody.name) {
            obj.firstName = objBody.name.split(' ').slice(0, -1).join(' ')
            obj.secondName = objBody.name.split(' ').slice(-1).join(' ')
        };
        if (objBody.firstName) {
            obj.firstName = objBody.firstName;
        };
        if (objBody.secondName) {
            obj.secondName = objBody.secondName;
        };
        if (objBody.password) {
            if (!/^(((?=.*[a-z])(?=.*[A-Z]))|((?=.*[a-z])(?=.*[0-9]))|((?=.*[A-Z])(?=.*[0-9])))(?=.{6,})/.test(objBody.password)) {
                throw new Error("password must contain at least 1 lowercase, 1 uppercase, 1 numeric, one special character and  eight characters or longer.")
            }
            let has_Password = hashPassword(objBody.password)
            obj.password = has_Password;
        };
        if (objBody.phone) {
            obj.phone = objBody.phone;
            obj.phoneVerified = false;
        };
        if (objBody.aboutme) {
            obj.aboutme = objBody.aboutme;
        };

        let data = await Users.findByIdAndUpdate(id, obj, { new: true });
        return { data: data }
    } catch (err) {
        console.log(err);
        throw err;
    }
};

// Get User List
export async function user_list(query: any, page = 1, limit: any = 100, sort = "createdAt", ascending = false) {
    try {
        let findQuery = { is_active: true }
        let check: any = {};
        check[sort] = ascending ? 1 : -1;
        let data = await Users.paginate(findQuery, { select: { firstName: 1, secondName: 1, email: 1, is_active: 1 }, page: page, limit: parseInt(limit), sort: check });
        for (const user of data.docs) {
            let role = await userRoles(user.id)
            user.role = role.roles[0]
        }
        return { status: true, data: data.docs, Pages: data.pages, count: data.total }
    } catch (err) {
        console.log(err);
        throw err;
    }
};

//  User Status
export async function user_status(id: any) {
    try {
        let user_data: any = await Users.findById(id)
        if (!user_data) throw new Error("User Not exist");
        let active = user_data.is_active == true ? false : true
        let data = await Users.findByIdAndUpdate(id, { is_active: active }, { new: true })
        return { message: active ? "avtive" : "inactive" }
    } catch (err) {
        console.log(err)
        throw err;
    }
};

//  User Login
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
        let result: any = await comparePassword(objBody.password, user_data.password)
        if (!result) {
            throw Error("Invalid login details.");
        }
        let Options = {
            uri: `${process.env.RBAC_URL}/role/list/${user_data.id}`,
            method: "GET",
            json: true
        }
        let success = await request(Options);
        if (!success.status) throw new Error("Fail to get Roles.")
        let token = await jwt_create({ id: user_data.id, role: success.data[0].role })
        return { token: token };
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
            html: inviteUserForm({
                username: userData.username,
                role: role,
                link: `${process.env.ANGULAR_URL}/user/register/${token}`
            })
        })
        return { status: true, data: "email send successfully" }
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  Get User Details
export async function userDetails(id: any) {
    try {
        if (!id) {
            throw new Error(MISSING);
        };
        return await Users.findById(id)
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  Get User Roles
export async function userRoles(id: any) {
    try {
        let Options = {
            uri: `${process.env.RBAC_URL}/role/list/${id}`,
            method: "GET",
            json: true
        }
        let success = await request(Options);
        if (!success.status) throw new Error("fail to get Roles");
        return { roles: success.data[0].role }
    } catch (err) {
        console.log(err)
        throw err
    };
};

//  Get user Capabilities
export async function userCapabilities(id: any) {
    try {
        let roles = await userRoles(id)
        if (roles.roles.length == 0) throw new Error("role not found")
        let Options = {
            uri: `${process.env.RBAC_URL}/role/capabilities/list`,
            method: "GET",
            qs: {
                role: roles.roles
            },
            json: true
        }
        let success = await request(Options);
        if (!success.status) throw new Error("fail to get Roles");
        return { roles: success.data }
    } catch (err) {
        console.log(err)
        throw err
    };
};

//  Forgot Password
export async function forgotPassword(objBody: any) {
    try {
        if (!objBody.email) {
            throw new Error(MISSING);
        };
        let userDetails: any = await Users.findOne({ email: objBody.email });
        if (!userDetails) throw new Error("User Invalid.")
        let token = jwt_for_url({ id: userDetails.id })
        let success = await nodemail({
            email: userDetails.email,
            subject: "CMP Reset password instructions",
            html: forgotPasswordForm({
                username: userDetails.name,
                link: `${process.env.ANGULAR_URL}/invite/user/:${token}`
            })
        })
        return { message: "successfully mail was sent." }
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  set new Password
export async function setNewPassword(objBody: any, token: any) {
    try {
        if (!objBody.password || !token) {
            throw new Error(MISSING)
        };

        let verifyToken: any = await jwt_Verify(token);
        if (!verifyToken) throw new Error("Invalid Token.");

        if (!/^(((?=.*[a-z])(?=.*[A-Z]))|((?=.*[a-z])(?=.*[0-9]))|((?=.*[A-Z])(?=.*[0-9])))(?=.{6,})/.test(objBody.password)) {
            throw new Error("password must contain at least 1 lowercase, 1 uppercase, 1 numeric, one special character and  eight characters or longer.")
        }
        let has_Password = hashPassword(objBody.password)

        let userDetails: any = await Users.findByIdAndUpdate(verifyToken.id, { password: has_Password }, { new: true });

        let Options = {
            uri: `${process.env.RBAC_URL}/role/list/${userDetails.id}`,
            method: "GET",
            json: true
        }
        let success = await request(Options);
        if (!success.status) throw new Error("Fail to get Roles.")

        let newToken = await jwt_create({ id: userDetails.id, role: success.data })
        return { token: token }
    } catch (err) {
        console.log(err);
        throw err;
    };
};