import { MISSING, USER_ROUTER, MAIL_SUBJECT, RESPONSE, INCORRECT_OTP } from "../utils/error_msg";
import { nodemail } from "../utils/email";
import { inviteUserForm, forgotPasswordForm, userLoginForm, userState, profileOtp } from "../utils/email_template";
import { jwt_create, jwt_Verify, jwt_for_url, hashPassword, comparePassword, generateOtp, jwtOtpToken, jwtOtpVerify } from "../utils/utils";
import { checkRoleScope, userRoleAndScope, roles_list, role_list } from "../role/module";
import { PaginateResult, Types } from "mongoose";
import { addRole, getRoles, roleCapabilitylist, updateRole } from "../utils/rbac";
import { groupUserList, addUserToGroup, removeUserToGroup, GetDocIdsForUser, userGroupsList } from "../utils/groups";
import { ANGULAR_URL } from "../utils/urls";
import { createUser, userDelete, userFindOne, userEdit, createJWT, userPaginatedList, userLogin, userFindMany, userList, groupCreate, groupFindOne, groupEdit, listGroup, userUpdate, otpVerify, getNamePatternMatch, uploadPhoto, changeEmailRoute, verifyJWT, groupPatternMatch } from "../utils/users";
import * as phoneNo from "phone";
import { createECDH } from "crypto";
import { loginSchema } from "./login-model";
//  Create User
export async function inviteUser(objBody: any, user: any) {
    try {
        if (!objBody.email || !objBody.role || !user) {
            throw new Error(USER_ROUTER.MANDATORY);
        };
        //  Check User Capability
        let admin_scope = await checkRoleScope(user.role, "create-user");
        if (!admin_scope) throw new Error(USER_ROUTER.INVALID_ADMIN);
        let userData: any = await createUser({
            email: objBody.email,
            firstName: objBody.firstName,
            lastName: objBody.lastName,
            middleName: objBody.middleName
        })
        let { firstName, lastName, middleName } = userData;
        let fullName = (firstName ? firstName + " " : "") + (middleName ? middleName + " " : "") + (lastName ? lastName : "");
        //  Add Role to User
        let RoleStatus = await addRole(userData._id, objBody.role)
        if (!RoleStatus.status) {
            await userDelete(userData.id)
            throw new Error(USER_ROUTER.CREATE_ROLE_FAIL);
        }
        //  Create 24hr Token
        let token = await jwt_for_url({
            id: userData._id,
            email: userData.email,
            role: objBody.role
        });
        //  Sent Mail to User
        let mailStatus = await nodemail({
            email: userData.email,
            subject: MAIL_SUBJECT.INVITE_USER,
            html: inviteUserForm({
                fullName,
                role: objBody.role,
                link: `${ANGULAR_URL}/user/register/${token}`
            })
        })
        return { userId: userData._id };
    } catch (err) {
        throw err;
    };
};

//  Register User
export async function RegisterUser(objBody: any, verifyToken: string) {
    try {
        if (!verifyToken) {
            throw new Error(USER_ROUTER.TOKEN_MISSING)
        }
        //  Verify Token
        let token: any = await jwt_Verify(verifyToken)
        if (!token) throw new Error(USER_ROUTER.TOKEN_INVALID)

        let user: any = await userFindOne("id", token.id)
        if (!user) throw new Error(USER_ROUTER.USER_NOT_EXIST)
        if (user.emailVerified) throw new Error(USER_ROUTER.ALREADY_REGISTER)
        const { firstName, lastName, middleName, password, phone, aboutme, countryCode, profilePic, name } = objBody

        if (!firstName || !lastName || !password || !phone || !countryCode) {
            throw new Error(USER_ROUTER.MANDATORY);
        };
        if (!/^(?=.{6,})(?=.*[@#$%^&+=]).*$/.test(password)) {
            throw new Error(USER_ROUTER.VALID_PASSWORD)
        };

        let phoneNumber: string = countryCode + phone
        if (!phoneNo(phoneNumber).length) {
            throw new Error(USER_ROUTER.VALID_PHONE_NO)
        }

        if (aboutme.length > 200) {
            throw new Error(USER_ROUTER.ABOUTME_LIMIT);
        }

        //  hash the password
        let success = await userEdit(token.id, {
            firstName, lastName, password, phone,
            profilePic,
            middleName: middleName || null,
            is_active: true,
            countryCode: countryCode || null,
            aboutme: aboutme || null,
            emailVerified: true,
            profilePicName: name
        })
        //  create life time token
        return { token: await createJWT({ id: success._id, role: token.role }) }
    } catch (err) {
        throw err;
    };
};

//  Edit user
export async function edit_user(id: string, objBody: any, user: any) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);
        if (id != user._id) {
            let admin_scope = await checkRoleScope(user.role, "create-user");
            if (!admin_scope) throw new Error(USER_ROUTER.INVALID_ADMIN);
        }
        if (objBody.password) {
            if (!/^(?=.{6,})(?=.*[@#$%^&+=]).*$/.test(objBody.password)) {
                throw new Error(USER_ROUTER.VALID_PASSWORD)
            }
        };
        if (objBody.phone && objBody.countryCode) {
            let phoneNumber = objBody.countryCode + objBody.phone
            if (!phoneNo(phoneNumber).length) {
                throw new Error(USER_ROUTER.VALID_PHONE_NO)
            }
        };
        let userRole;
        if (id != user._id && objBody.role) {
            userRole = await updateRole(id, objBody.updateRole, objBody.role);
        }
        if (objBody.aboutme) {
            if (objBody.aboutme.length > 200) {
                throw new Error(USER_ROUTER.ABOUTME_LIMIT);
            }
        };
        // update user with edited fields
        let userInfo = await userEdit(id, objBody);
        userInfo.role = userRole;
        return userInfo

    } catch (err) {
        throw err;
    };
};

// Get User List
export async function user_list(query: any, userId: string, page = 1, limit: any = 100, sort = "createdAt", ascending = false) {
    try {
        let findQuery = { _id: { $ne: Types.ObjectId(userId) } }
        let { docs, pages, total }: PaginateResult<any> = await userPaginatedList(findQuery, { firstName: 1, lastName: 1, middleName: 1, email: 1, is_active: 1 }, page, parseInt(limit), sort, ascending);
        const data = await Promise.all(docs.map(async doc => {
            return { ...doc, id: doc._id, role: (((await userRoleAndScope(doc._id)) as any).data.global || [""])[0] }
        }));
        let rolesBody: any = await role_list();
        data.map((user) => {
            rolesBody.roles.forEach((roleInfo: any) => {
                if (roleInfo.role == user.role) {
                    user.role = roleInfo.roleName;
                    return false;
                }
            });
            return user
        })
        return { data, page: +page, pages: pages, count: total };
    } catch (err) {
        throw err;
    };
};
export async function getUserDetail(userId: string) {
    try {
        let detail = await userFindOne('_id', userId, { firstName: 1, secondName: 1, lastName: 1, middleName: 1, name: 1, email: 1, is_active: 1, phone: 1, countryCode: 1, aboutme: 1, profilePic: 1 });
        return { ...detail, id: detail._id, role: (((await userRoleAndScope(detail._id)) as any).data.global || [""])[0] }
    } catch (err) {
        throw err;
    };
};

// change User Status
export async function user_status(id: string, user: any) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);

        let admin_scope = await checkRoleScope(user.role, "create-user");
        if (!admin_scope) throw new Error(USER_ROUTER.INVALID_ADMIN);

        let userData: any = await userFindOne("id", id);
        if (!userData) throw new Error(USER_ROUTER.USER_NOT_EXIST);
        if (!userData.emailVerified) throw new Error("User not registered Yet.")

        let data: any = await userEdit(id, { is_active: userData.is_active ? false : true })
        let state = data.is_active ? "Activated" : "Inactivated"

        await nodemail({
            email: userData.email,
            subject: `Your account has been ${state} | CMP`,
            html: userState({
                state
            })
        })
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
        let userData: any = await userFindOne("email", objBody.email);
        if (!userData) throw new Error(USER_ROUTER.USER_NOT_EXIST);
        if (!userData.emailVerified) throw new Error(USER_ROUTER.USER_NOT_REGISTER)
        if (!userData.is_active) throw new Error(USER_ROUTER.DEACTIVATED_BY_ADMIN)
        await loginSchema.create({ ip: objBody.ip, userId: userData._id });
        const response = await userLogin({ message: RESPONSE.SUCCESS_EMAIL, email: objBody.email, password: objBody.password })
        await nodemail({
            email: userData.email,
            subject: MAIL_SUBJECT.LOGIN_SUBJECT,
            html: userLoginForm({
                username: userData.firstName
            })
        })
        return response
    } catch (err) {
        throw err;
    };
};

//  Resend invite link
export async function userInviteResend(id: string, role: any) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);

        let userData: any = await userFindOne("id", id)
        if (!userData.emailVerified) throw new Error(USER_ROUTER.EMAIL_VERIFIED)
        //  create token for 24hrs
        let token = await jwt_for_url({ user: id, role: role });
        //  mail sent user
        let success = await nodemail({
            email: userData.email,
            subject: MAIL_SUBJECT.INVITE_USER,
            html: inviteUserForm({
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
        return await userFindOne("id", id, { password: 0 })
    } catch (err) {
        throw err;
    };
};

//  Get User Roles
export async function userRoles(id: any) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);
        //  Get User Roles
        let [role, formattedRolesData]: any = await Promise.all([
            getRoles(id),
            role_list()
        ])
        if (!role.status) throw new Error(USER_ROUTER.ROLE_NOT_FOUND);
        const formattedRole = formattedRolesData.roles.find((roleObj: any) => roleObj.role == role.data[0].role)
        return { roles: formattedRole ? formattedRole.roleName : role.data[0].role }
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
        if (!roles.data.length) throw new Error(USER_ROUTER.ROLE_NOT_FOUND)
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
        let userDetails: any = await userFindOne("email", objBody.email);
        if (!userDetails) {
            throw new Error('Email ID is not registered')
        }
        let { firstName, lastName, middleName } = userDetails;
        let fullName = (firstName ? firstName + " " : "") + (middleName ? middleName + " " : "") + (lastName ? lastName : "");
        if (!userDetails) throw new Error(USER_ROUTER.USER_NOT_EXIST)
        if (!userDetails.emailVerified) throw new Error(USER_ROUTER.USER_NOT_REGISTER)
        //  Create Token
        let authOtp = { "otp": generateOtp(4) }
        let token = await jwtOtpToken(authOtp);
        await userUpdate({ otp_token: token, id: userDetails._id });
        let success = await nodemail({
            email: userDetails.email,
            subject: MAIL_SUBJECT.FORGOT_PASSWORD,
            html: forgotPasswordForm({
                fullName,
                otp: authOtp.otp
            })
        })
        let tokenId = await jwt_for_url({ "id": userDetails._id });
        return { message: RESPONSE.SUCCESS_EMAIL, email: userDetails.email, id: tokenId }
    } catch (err) {
        console.error(err);
        throw err;
    };
};

//  set new Password
export async function setNewPassword(objBody: any) {
    try {
        if (!objBody.password) {
            throw new Error("required password field")
        };
        //  verified the token
        if (!/^(?=.{6,})(?=.*[@#$%^&+=]).*$/.test(objBody.password)) {
            throw new Error(USER_ROUTER.VALID_PASSWORD)
        }
        // update password
        let tokenData: any = await jwt_Verify(objBody.id);
        if (!tokenData) {
            throw new Error(USER_ROUTER.TOKEN_INVALID);
        }
        // update password
        let userData: any = await userEdit(tokenData.id, { password: objBody.password });
        //let role = await getRoles(userData._id)
        //if (!role.status) throw new Error(USER_ROUTER.ROLE_NOT_FOUND)
        //  create life Time Token
        //return { token: await createJWT({ id: userDetails.id, role: role.data[0].role }) }
        return { message: "succefully updated password" };

    } catch (err) {
        console.error(err);
        throw err;
    };
};


//  Create Group
export async function createGroup(objBody: any, userId: string) {
    try {
        const { name, description } = objBody
        if (!name) throw new Error(USER_ROUTER.MANDATORY);
        return await groupCreate({
            name: name,
            description: description,
            createdBy: userId
        });
    } catch (err) {
        throw err;
    };
};

//  change Group status
export async function groupStatus(id: any, userId: string) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);
        let group: any = await groupFindOne("id", id);
        if (!group) throw new Error(USER_ROUTER.GROUP_NOT_FOUND);
        if (group.createdBy._id != userId) throw new Error("Only this Action Performed By Group Admin.")
        let data: any = await groupEdit(id, { is_active: group.is_active ? false : true });
        return { message: data.is_active ? RESPONSE.ACTIVE : RESPONSE.INACTIVE };
    } catch (err) {
        console.error(err);
        throw err;
    };
};

//  Edit Group
export async function editGroup(objBody: any, id: string, userId: string) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);
        let group: any = await groupFindOne("id", id);
        if (group.createdBy._id != userId) throw new Error("Only this Action Performed By Group Admin.")
        const { name, description } = objBody
        let obj: any = {}
        if (name) {
            obj.name = name;
        };
        if (description) {
            obj.description = description;
        };
        return await groupEdit(id, obj);
    } catch (err) {
        throw err;
    };
};

//  Get group List
export async function groupList(userId: string) {
    try {
        let groupIds = await userGroupsList(userId)
        let meCreatedGroup = await groupPatternMatch({ is_active: true }, {}, { createdBy: userId }, {}, "updatedAt")
        let sharedGroup = await groupPatternMatch({ is_active: true }, {}, { _id: groupIds }, {}, "updatedAt")
        let groups = [...meCreatedGroup, ...sharedGroup]
        return await Promise.all(groups.map(async (group: any) => {
            return { ...group, users: ((await groupUserList(group._id)) as any).length }
        }));
    } catch (err) {
        throw err;
    };
};

//  Group detail of group
export async function groupDetail(id: string) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);
        let data: any = await groupFindOne("id", id)
        if (!data) throw new Error(USER_ROUTER.GROUP_NOT_FOUND)
        return { ...data, users: await userList({ _id: { $in: await groupUserList(data._id) } }, { name: 1, email: 1 }) }
    } catch (err) {
        throw err;
    };
};

//  Add Member to Group
export async function addMember(id: string, users: any[], userId: string) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);
        if (!id || !users) throw new Error(USER_ROUTER.MANDATORY);
        if (!Array.isArray(users)) throw new Error(USER_ROUTER.USER_ARRAY)
        let data: any = await groupFindOne("id", id)
        if (!data) throw new Error(USER_ROUTER.GROUP_NOT_FOUND);
        if (data.createdBy._id != userId) throw new Error("Only this Action Performed By Group Admin.")
        await Promise.all(users.map(async (user: any) => { if (data.createdBy._id != user) { await addUserToGroup(user, id) } }))
        return { message: RESPONSE.ADD_MEMBER }
    } catch (err) {
        throw err
    };
};

//  Remove Member From Group
export async function removeMembers(id: string, users: any[], userId: string) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);
        if (!id || !users) throw new Error(USER_ROUTER.MANDATORY);
        if (!Array.isArray(users)) throw new Error(USER_ROUTER.USER_ARRAY)
        let data: any = await groupFindOne("id", id)
        if (!data) throw new Error(USER_ROUTER.GROUP_NOT_FOUND);
        await Promise.all(users.map(async (user: any) => {
            if (user == data.createdBy._id) throw new Error("This Action Is Not Valid")
            if (userId != user && data.createdBy._id != userId) throw new Error("Only this Action Performed By Group Admin.")
            await removeUserToGroup(user, id)
        }))
        return { message: RESPONSE.REMOVE_MEMBER }
    } catch (err) {
        throw err
    };
};

//  user and group suggestion
export async function userSuggestions(search: string, userId: string) {
    try {
        search = search.trim()
        let groupIds = await userGroupsList(userId)
        let meCreatedGroup = await groupPatternMatch({ is_active: true }, { name: search }, { createdBy: userId }, {}, "updatedAt")
        let sharedGroup = await groupPatternMatch({ is_active: true }, { name: search }, { _id: groupIds }, {}, "updatedAt")
        let groups = [...meCreatedGroup, ...sharedGroup]
        const searchQuery = search ? { name: new RegExp(search, "i"), emailVerified: true } : { is_active: true, emailVerified: true }
        let users: any = search ?
            await getNamePatternMatch(search, { name: 1, firstName: 1, lastName: 1, middleName: 1, email: 1 }) :
            await userList({ ...searchQuery, is_active: true }, { name: 1, firstName: 1, lastName: 1, middleName: 1, email: 1 });
        users = await Promise.all(users.map(async (user: any) => { return { ...user, type: "user", role: (((await userRoleAndScope(user._id)) as any).data.global || [""])[0] } }))
        let rolesBody: any = await role_list();
        users.map((user: any) => {
            rolesBody.roles.forEach((roleInfo: any) => {
                if (roleInfo.role == user.role) {
                    user.role = roleInfo.roleName;
                    return false;
                }
            });
            return user
        })
        groups = groups.map(group => { return { ...group, type: "group" } })
        return [...users, ...groups]
    } catch (err) {
        throw err
    };
};
export async function otpVerification(objBody: any) {
    try {
        if (!objBody.otp) {
            throw new Error("Required otp field")
        };
        let userInfo: any = await userFindOne("email", objBody.email);
        let token: any = await jwtOtpVerify(userInfo.otp_token)
        let tokenId = await jwt_for_url({ id: userInfo._id });
        userInfo.id = tokenId;
        if ((objBody.otp) == Number(token.otp)) {
            let userData = await otpVerify(userInfo);
            return userData
        } else {
            throw new Error(INCORRECT_OTP);
        }
    }
    catch (err) {
        throw err
    }
}
export async function userInformation(id: any) {
    try {
        let userInfo = await userFindOne("id", id);
        return userInfo;
    }
    catch (err) {
        throw err
    }
}
export async function changeEmailInfo(objBody: any, user: any) {
    try {
        if (!objBody.email || !objBody.password) {
            throw Error(USER_ROUTER.MANDATORY);
        }
        if ((typeof objBody.email !== "string") || (typeof objBody.password !== "string")) {
            throw Error(USER_ROUTER.INVALID_FIELDS);
        }
        //  find User
        let emailExist = await userFindOne("email", objBody.email);
        if (emailExist) throw new Error("Already email exist.")
        let validUser = await userLogin({ email: user.email, password: objBody.password })
        if (!validUser.token) throw new Error("Enter valid credentials.");
        let authOtp = { "otp": generateOtp(4), "newEmail": objBody.email }
        let token = await jwtOtpToken(authOtp);
        let userInfo = await userUpdate({ otp_token: token, id: user._id });
        let { firstName, lastName, middleName } = userInfo;
        let fullName = (firstName ? firstName + " " : "") + (middleName ? middleName + " " : "") + (lastName ? lastName : "");
        let success = await nodemail({
            email: objBody.email,
            subject: MAIL_SUBJECT.OTP_SUBJECT,
            html: profileOtp({
                fullName,
                otp: authOtp.otp
            })
        });
        return { message: RESPONSE.SUCCESS_EMAIL };
    }
    catch (err) {
        throw err
    };
};

export async function profileOtpVerify(objBody: any, user: any) {
    try {
        if (!objBody.otp) throw new Error("Otp is Missing.");
        let token: any = await jwt_Verify(user.otp_token);
        if (objBody.otp == token.otp) {
            return await userEdit(user._id, { email: token.newEmail })
        }
        else {
            throw new Error("Enter Valid Otp.");
        }
    } catch (err) {
        throw err
    }
}
export async function loginHistory(id: string) {
    try {
        let userLoginHistory = await loginSchema.find({ userId: id }).sort({createdAt:1})
        return userLoginHistory;
    } catch (err) {
        throw err
    }
}
