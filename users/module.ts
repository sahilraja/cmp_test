import { MISSING } from "../utils/error_msg";
import { Users } from "./model";
import { nodemail } from "../utils/email";
import { inviteUserForm, forgotPasswordForm } from "../utils/email_template";
import { jwt_create, jwt_Verify, jwt_for_url, hashPassword, comparePassword } from "../utils/utils";
import { checkRoleScope, userRoleAndScope } from "../role/module";
import { PaginateResult, Types } from "mongoose";
import { addRole, getRoles, roleCapabilitylist } from "../utils/rbac";
import { groupsModel } from "./group-model";
import { groupUserList, addUserToGroup, removeUserToGroup } from "../utils/groups";

const ANGULAR_URL = process.env.ANGULAR_URL || "http://localhost:4200"

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
        let RoleStatus = await addRole(userData.id, objBody.role)
        if (!RoleStatus.status) {
            await Users.findByIdAndRemove(userData.id)
            throw new Error("Fail to create role");
        }
        let token = await jwt_for_url({
            id: userData.id,
            firstName: userData.firstName,
            secondName: userData.secondName,
            email: userData.email,
            role: objBody.role
        });
        let mailStatus = await nodemail({
            email: userData.email,
            subject: "Invitation from CITIIS Management Platform",
            html: inviteUserForm({
                username: objBody.name,
                role: objBody.role,
                link: `${ANGULAR_URL}/user/register/${token}`
            })
        })
        return { userId: userData.id };
    } catch (err) {
        console.log(err)
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
        if (!token) throw new Error("Invalid Token.")

        let user: any = await Users.findById(token.id)
        if (user.emailVerified) {
            throw new Error("Already User Register.")
        }
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
    };
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
            if (isNaN(objBody.phone) || objBody.phone.length != 10) {
                throw new Error("Enter Valid Phone Number.")
            }
            obj.phone = objBody.phone;
            obj.phoneVerified = false;
        };
        if (objBody.aboutme) {
            obj.aboutme = objBody.aboutme;
        };

        let data: any = await Users.findByIdAndUpdate(id, obj, { new: true });
        return { data: data }
    } catch (err) {
        console.log(err);
        throw err;
    }
};

// Get User List
export async function user_list(query: any, userId: any, page = 1, limit: any = 100, sort = "createdAt", ascending = false) {
    try {
        let findQuery = { _id: { $ne: Types.ObjectId(userId) } }
        let check: any = {};
        check[sort] = ascending ? 1 : -1;
        let { docs, pages, total }: PaginateResult<any> = await Users.paginate(findQuery, { select: { firstName: 1, secondName: 1, email: 1, is_active: 1 }, page: page, limit: parseInt(limit), sort: check });
        const data = await Promise.all(docs.map(async doc => {
            const user = { ...doc.toJSON(), id: doc.id }

            let userCapabilities: any = await userRoleAndScope(user.id)
            console.log("user is ", user.id)
            console.log("user capabilities", userCapabilities.data)
            user.role = userCapabilities.data.global[0]
            return user
        }));
        return { data, pages: pages, count: total }
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
        let userData: any = await Users.findOne({ email: objBody.email });
        if (!userData) throw new Error("Invalid User");
        if (!userData.emailVerified) throw new Error("User Not Register.")
        let result: any = await comparePassword(objBody.password, userData.password)
        if (!result) {
            throw Error("Invalid login details.");
        }
        if (!userData.is_active) throw new Error("Account Deactivated By Admin.")
        let Role = await getRoles(userData.id)
        if (!Role.status) throw new Error("Fail to get Roles.")
        let token = await jwt_create({ id: userData.id, role: Role.data[0].role })
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
                link: `${ANGULAR_URL}/user/register/${token}`
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
        let role = await getRoles(id)
        if (!role.status) throw new Error("fail to get Roles");
        return { roles: role.data[0].role }
    } catch (err) {
        console.log(err)
        throw err
    };
};

//  Get user Capabilities
export async function userCapabilities(id: any) {
    try {
        let roles = await getRoles(id)
        if (roles.data.length == 0) throw new Error("role not found")
        let success = await roleCapabilitylist(roles.data[0].role)
        if (!success.status) throw new Error("fail to get Roles");
        return { roles: success.data }
    } catch (err) {
        console.log(err);
        throw err;
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
                username: (userDetails.firstName) ? userDetails.firstName : userDetails.secondName,
                link: `${ANGULAR_URL}/user/reset-password/:${token}`
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
        let role = await getRoles(userDetails.id)
        if (!role.status) throw new Error("Fail to get Roles.")

        let newToken = await jwt_create({ id: userDetails.id, role: role.data })
        return { token: token }
    } catch (err) {
        console.log(err);
        throw err;
    };
};


//  Create Group
export async function createGroup(objBody: any) {
    try {
        const { name, description } = objBody
        if (!name || !description) throw new Error("Missing Field.");
        let data = await groupsModel.create({
            name: name,
            description: description
        });
        return data
    } catch (err) {
        throw err;
    };
};

//  change Group status
export async function groupStatus(id: any) {
    try {
        if (!id) throw new Error("Missing Id.")
        let group: any = await groupsModel.findById(id);
        if (!group) throw new Error("City Not Found");
        let data: any = await groupsModel.findByIdAndUpdate(id, { is_active: group.is_active == true ? false : true }, { new: true });
        return { message: data.is_active ? "Active" : "Inactive" };
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  Edit Group
export async function editGroup(objBody: any, id: string) {
    try {
        const { name, description } = objBody
        let obj: any = {}
        if (name) {
            obj.name = name;
        };
        if (description) {
            obj.description = description;
        };
        let data = await groupsModel.findByIdAndUpdate(id, obj, { new: true });
        return data
    } catch (err) {
        throw err;
    };
};

//  Get group List
export async function groupList() {
    try {
        let group = await groupsModel.find({});
        const data = await Promise.all(group.map(async (key: any) => {
            return { ...key.toJSON(), users: ((await groupUserList(key._id)) as any).length }
        }))
        return data;
    } catch (err) {
        throw err;
    };
};

//  Group detail
export async function groupDetail(id: string) {
    try {
        if (!id) throw new Error("Missing Id");
        let data: any = await groupsModel.findById(id)
        if (!data) throw new Error("Group Not Found.")
        const group = data.toJSON()
        let userIds = await groupUserList(data._id)
        group.users = await Users.find({ _id: { $in: userIds } }, { firstName: 1, secondName: 1, email: 1 });
        return group;
    } catch (err) {
        throw err;
    };
};

//  Add Member
export async function addMember(id: string, users: any[]) {
    try {
        if (!id || !users) throw new Error("Missing Fields.");
        if (!Array.isArray(users)) throw new Error("Users must be an Array.")
        let data: any = await groupsModel.findById(id)
        if (!data) throw new Error("Group Not Found.");
        await Promise.all([users.map(async (user: any) => {
            await addUserToGroup(user, id)
        })])
        return { message: "added successfully" }
    } catch (err) {
        throw err
    };
};

//  Remove Member
export async function removeMembers(id: string, users: any[]) {
    try {
        if (!id || !users) throw new Error("Missing Fields.");
        if (!Array.isArray(users)) throw new Error("Users must be an Array.")
        let data: any = await groupsModel.findById(id)
        if (!data) throw new Error("Group Not Found.");
        await Promise.all([users.map(async (user: any) => {
            await removeUserToGroup(user, id)
        })])
        return { message: "added successfully" }
    } catch (err) {
        throw err
    };
};

export async function userSuggestions(search: string) {
    try {
        // let groups = await groupsModel.find({ name: new RegExp(search, "i") }, { name: 1 })
        // groups = groups.map((group: any) => { return { ...group.toJSON(), type: "group" } })
        let users: any = await Users.find({ $or: [{ firstName: new RegExp(search, "i") }, { secondName: new RegExp(search, "i") }] }, { firstName: 1, secondName: 1 });
        users = await Promise.all(users.map(async (user: any) => { return { ...user.toJSON(), type: "user", role: ((await userRoleAndScope(user._id)) as any).data.global[0] } }))
        //  groups removed in removed
        return [...users]
    } catch (err) {
        throw err
    };
};