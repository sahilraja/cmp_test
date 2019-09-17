import { MISSING, USER_ROUTER, MAIL_SUBJECT, RESPONSE } from "../utils/error_msg";
import { Users } from "./model";
import { nodemail } from "../utils/email";
import { inviteUserForm, forgotPasswordForm } from "../utils/email_template";
import { jwt_create, jwt_Verify, jwt_for_url, hashPassword, comparePassword } from "../utils/utils";
import { checkRoleScope, userRoleAndScope } from "../role/module";
import { PaginateResult, Types } from "mongoose";
import { addRole, getRoles, roleCapabilitylist } from "../utils/rbac";
import { groupsModel } from "./group-model";
import { groupUserList, addUserToGroup, removeUserToGroup } from "../utils/groups";
import { ANGULAR_URL } from "../utils/urls";

//  Create User
export async function inviteUser(objBody: any, user: any) {
    try {
        if (!objBody.email || !objBody.name || !objBody.role || !user) {
            throw new Error(USER_ROUTER.MANDATORY);
        };
        //  Check User Capability
        let admin_scope = await checkRoleScope(user.role, "create-user");
        if (!admin_scope) throw new Error(USER_ROUTER.INVALID_ADMIN);
        let userData: any = await Users.create({
            firstName: objBody.name.split(' ').slice(0, -1).join(' '),
            secondName: objBody.name.split(' ').slice(-1).join(' '),
            email: objBody.email,
        });
        //  Add Role to User
        let RoleStatus = await addRole(userData.id, objBody.role)
        if (!RoleStatus.status) {
            await Users.findByIdAndRemove(userData.id)
            throw new Error(USER_ROUTER.CREATE_ROLE_FAIL);
        }
        //  Create 24hr Token
        let token = await jwt_for_url({
            id: userData.id,
            firstName: userData.firstName,
            secondName: userData.secondName,
            email: userData.email,
            role: objBody.role
        });
        //  Sent Mail to User
        let mailStatus = await nodemail({
            email: userData.email,
            subject: MAIL_SUBJECT.INVITE_USER,
            html: inviteUserForm({
                username: objBody.name,
                role: objBody.role,
                link: `${ANGULAR_URL}/user/register/${token}`
            })
        })
        return { userId: userData.id };
    } catch (err) {
        throw err;
    };
};

//  Register User
export async function RegisterUser(objBody: any, verifyToken: string, uploadPhoto: any) {
    try {
        if (!verifyToken) {
            throw new Error(USER_ROUTER.TOKEN_MISSING)
        }
        //  Verify Token
        let token: any = await jwt_Verify(verifyToken)
        if (!token) throw new Error(USER_ROUTER.TOKEN_INVALID)

        let user: any = await Users.findById(token.id)
        if (user.emailVerified) {
            throw new Error(USER_ROUTER.ALREADY_REGISTER)
        }
        const { name, password, phone, aboutme } = objBody

        if (!name || !password || !phone) {
            throw new Error(USER_ROUTER.MANDATORY);
        };
        if (!/^(?=.{6,})(?=.*[@#$%^&+=]).*$/.test(password)) {
            throw new Error(USER_ROUTER.VALID_PASSWORD)
        }

        if (isNaN(phone) || phone.length != 10) {
            throw new Error(USER_ROUTER.VALID_PHONE_NO)
        }

        //  hash the password
        let has_Password = await hashPassword(password)

        let success: any = await Users.findByIdAndUpdate(token.id, {
            firstName: name.split(' ').slice(0, -1).join(' '),
            secondName: name.split(' ').slice(-1).join(' '),
            password: has_Password,
            phone: phone,
            aboutme: aboutme || null,
            emailVerified: true
        }, { new: true });
        //  create life time token
        return { token: await jwt_create({ id: success.id, role: token.role }) }
    } catch (err) {
        throw err;
    };
};

//  Edit user
export async function edit_user(id: string, objBody: any, user: any) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);
        if (id != user.id) {
            let admin_scope = await checkRoleScope(user.role, "create-user");
            if (!admin_scope) throw new Error(USER_ROUTER.INVALID_ADMIN);
        }
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
            if (!/^(?=.{6,})(?=.*[@#$%^&+=]).*$/.test(objBody.password)) {
                throw new Error(USER_ROUTER.VALID_PASSWORD)
            }
            let has_Password = hashPassword(objBody.password)
            obj.password = has_Password;
        };
        if (objBody.phone) {
            if (isNaN(objBody.phone) || objBody.phone.length != 10) {
                throw new Error(USER_ROUTER.VALID_PHONE_NO)
            }
            obj.phone = objBody.phone;
            obj.phoneVerified = false;
        };
        if (objBody.aboutme) {
            obj.aboutme = objBody.aboutme;
        };
        // update user with edited fields
        return await Users.findByIdAndUpdate(id, obj, { new: true });
    } catch (err) {
        throw err;
    };
};

// Get User List
export async function user_list(query: any, userId: string, page = 1, limit: any = 100, sort = "createdAt", ascending = false) {
    try {
        let findQuery = { _id: { $ne: Types.ObjectId(userId) } }
        let check: any = {};
        check[sort] = ascending ? 1 : -1;
        let { docs, pages, total }: PaginateResult<any> = await Users.paginate(findQuery, { select: { firstName: 1, secondName: 1, email: 1, is_active: 1 }, page: page, limit: parseInt(limit), sort: check });
        const data = await Promise.all(docs.map(async doc => {
            return { ...doc.toJSON(), id: doc.id, role: (((await userRoleAndScope(doc.id)) as any).data.global || [""])[0] }
        }));
        return { data, pages: pages, count: total };
    } catch (err) {
        throw err;
    };
};

// change User Status
export async function user_status(id: string, userId: string) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);

        let admin_scope = await checkRoleScope(userId, "create-user");
        if (!admin_scope) throw new Error(USER_ROUTER.INVALID_ADMIN);

        let userData: any = await Users.findById(id)
        if (!userData) throw new Error(USER_ROUTER.USER_NOT_EXIST);

        let data: any = await Users.findByIdAndUpdate(id, { is_active: userData.is_active ? false : false }, { new: true })
        return { message: data.is_active ? RESPONSE.ACTIVE : RESPONSE.INACTIVE }
    } catch (err) {
        throw err;
    };
};

//  User Login
export async function user_login(objBody: any) {
    try {
        if (!objBody.email || !objBody.password) {
            throw Error(USER_ROUTER.MANDATORY);
        }
        if ((typeof objBody.email !== "string") || (typeof objBody.password !== "string")) {
            throw Error(USER_ROUTER.INVALID_FIELDS);
        }
        //  find User
        let userData: any = await Users.findOne({ email: objBody.email });
        if (!userData) throw new Error(USER_ROUTER.USER_NOT_EXIST);
        if (!userData.emailVerified) throw new Error(USER_ROUTER.USER_NOT_REGISTER)
        //  compare with hash password
        let result: any = await comparePassword(objBody.password, userData.password)
        if (!result) {
            throw Error(USER_ROUTER.INVALID_LOGIN_DETAILS);
        }
        if (!userData.is_active) throw new Error(USER_ROUTER.DEACTIVATED_BY_ADMIN)
        //  Get User Role
        let Role = await getRoles(userData.id)
        if (!Role.status) throw new Error(USER_ROUTER.ROLE_NOT_FOUND)
        let token = await jwt_create({ id: userData.id, role: Role.data[0].role })
        return { token: token };
    } catch (err) {
        throw err;
    };
};

//  Resend invite link
export async function userInviteResend(id: string, role: any) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);

        let userData: any = await Users.findById(id)
        if (!userData.emailVerified) throw new Error(USER_ROUTER.EMAIL_VERIFIED)
        //  create token for 24hrs
        let token = await jwt_for_url({ user: id, role: role });
        //  mail sent user
        let success = await nodemail({
            email: userData.email,
            subject: MAIL_SUBJECT.INVITE_USER,
            html: inviteUserForm({
                username: userData.username,
                role: role,
                link: `${ANGULAR_URL}/user/register/${token}`
            })
        })
        return { message: RESPONSE.SUCCESS_EMAIL }
    } catch (err) {
        throw err;
    };
};

//  Get User Details
export async function userDetails(id: any) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);
        return await Users.findById(id).select({ password: -1 })
    } catch (err) {
        throw err;
    };
};

//  Get User Roles
export async function userRoles(id: any) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);
        //  Get User Roles
        let role = await getRoles(id)
        if (!role.status) throw new Error(USER_ROUTER.ROLE_NOT_FOUND);
        return { roles: role.data[0].role }
    } catch (err) {
        throw err
    };
};

//  Get user Capabilities
export async function userCapabilities(id: any) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);
        //  Get Role of User
        let roles = await getRoles(id)
        if (roles.data.length) throw new Error(USER_ROUTER.ROLE_NOT_FOUND)
        //  Get Capabilities of User
        let success = await roleCapabilitylist(roles.data[0].role)
        if (!success.status) throw new Error(USER_ROUTER.CAPABILITIES_NOT_FOUND);
        return { roles: success.data }
    } catch (err) {
        throw err;
    };
};

//  Forgot Password
export async function forgotPassword(objBody: any) {
    try {
        if (!objBody.email) {
            throw new Error(USER_ROUTER.MANDATORY);
        };
        //  Find User
        let userDetails: any = await Users.findOne({ email: objBody.email });
        if (!userDetails) throw new Error(USER_ROUTER.USER_NOT_EXIST)
        if (!userDetails.emailVerified) throw new Error(USER_ROUTER.USER_NOT_REGISTER)
        //  Create Token
        let token = await jwt_for_url({ id: userDetails.id })
        let success = await nodemail({
            email: userDetails.email,
            subject: MAIL_SUBJECT.FORGOT_PASSWORD,
            html: forgotPasswordForm({
                username: userDetails.firstName + " " + userDetails.secondName,
                link: `${ANGULAR_URL}/user/reset-password/${token}`
            })
        })
        return { message: RESPONSE.SUCCESS_EMAIL }
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  set new Password
export async function setNewPassword(objBody: any, token: any) {
    try {
        if (!objBody.password || !token) {
            throw new Error(USER_ROUTER.MANDATORY)
        };
        //  verified the token
        let verifyToken: any = await jwt_Verify(token);
        if (!verifyToken) throw new Error(USER_ROUTER.TOKEN_INVALID);
        if (!/^(?=.{6,})(?=.*[@#$%^&+=]).*$/.test(objBody.password)) {
            throw new Error(USER_ROUTER.VALID_PASSWORD)
        }
        //  hash password
        let has_Password = hashPassword(objBody.password)
        // update password
        let userDetails: any = await Users.findByIdAndUpdate(verifyToken.id, { password: has_Password }, { new: true });
        let role = await getRoles(userDetails.id)
        if (!role.status) throw new Error(USER_ROUTER.ROLE_NOT_FOUND)
        //  create life Time Token
        let newToken = await jwt_create({ id: userDetails.id, role: role.data[0].role })
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
        if (!name || !description) throw new Error(USER_ROUTER.MANDATORY);
        return await groupsModel.create({
            name: name,
            description: description
        });
    } catch (err) {
        throw err;
    };
};

//  change Group status
export async function groupStatus(id: any) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);
        let group: any = await groupsModel.findById(id);
        if (!group) throw new Error(USER_ROUTER.GROUP_NOT_FOUND);
        let data: any = await groupsModel.findByIdAndUpdate(id, { is_active: group.is_active ? false : true }, { new: true });
        return { message: data.is_active ? RESPONSE.ACTIVE : RESPONSE.INACTIVE };
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  Edit Group
export async function editGroup(objBody: any, id: string) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);
        const { name, description } = objBody
        let obj: any = {}
        if (name) {
            obj.name = name;
        };
        if (description) {
            obj.description = description;
        };
        return await groupsModel.findByIdAndUpdate(id, obj, { new: true });
    } catch (err) {
        throw err;
    };
};

//  Get group List
export async function groupList() {
    try {
        let groups = await groupsModel.find({ is_active: true }).sort({ updatedAt: -1 });
        return await Promise.all(groups.map(async (group: any) => {
            return { ...group.toJSON(), users: ((await groupUserList(group._id)) as any).length }
        }));
    } catch (err) {
        throw err;
    };
};

//  Group detail of group
export async function groupDetail(id: string) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);
        let data: any = await groupsModel.findById(id)
        if (!data) throw new Error(USER_ROUTER.GROUP_NOT_FOUND)
        return { ...data.toJSON(), users: await Users.find({ _id: { $in: await groupUserList(data._id) } }, { firstName: 1, secondName: 1, email: 1 }) }
    } catch (err) {
        throw err;
    };
};

//  Add Member to Group
export async function addMember(id: string, users: any[]) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);
        if (!id || !users) throw new Error(USER_ROUTER.MANDATORY);
        if (!Array.isArray(users)) throw new Error(USER_ROUTER.USER_ARRAY)
        let data: any = await groupsModel.findById(id)
        if (!data) throw new Error(USER_ROUTER.GROUP_NOT_FOUND);
        await Promise.all(users.map(async (user: any) => {
            await addUserToGroup(user, id)
        }))
        return { message: RESPONSE.ADD_MEMBER }
    } catch (err) {
        throw err
    };
};

//  Remove Member From Group
export async function removeMembers(id: string, users: any[]) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);
        if (!id || !users) throw new Error(USER_ROUTER.MANDATORY);
        if (!Array.isArray(users)) throw new Error(USER_ROUTER.USER_ARRAY)
        let data: any = await groupsModel.findById(id)
        if (!data) throw new Error(USER_ROUTER.GROUP_NOT_FOUND);
        await Promise.all(users.map(async (user: any) => {
            await removeUserToGroup(user, id)
        }))
        return { message: RESPONSE.REMOVE_MEMBER }
    } catch (err) {
        throw err
    };
};

//  user and group suggestion
export async function userSuggestions(search: string) {
    try {
        // let groups = await groupsModel.find({ name: new RegExp(search, "i") }, { name: 1 })
        // groups = groups.map((group: any) => { return { ...group.toJSON(), type: "group" } })
        let users: any = await Users.find({ $or: [{ firstName: new RegExp(search, "i") }, { secondName: new RegExp(search, "i") }] }, { firstName: 1, secondName: 1 });
        users = await Promise.all(users.map(async (user: any) => { return { ...user.toJSON(), type: "user", role: (((await userRoleAndScope(user._id)) as any).data.global || [""])[0] } }))
        //  groups removed in removed
        return [...users]
    } catch (err) {
        throw err
    };
};