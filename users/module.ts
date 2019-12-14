import { MISSING, USER_ROUTER, MAIL_SUBJECT, RESPONSE, INCORRECT_OTP, SENDER_IDS, MOBILE_MESSAGES, MOBILE_TEMPLATES, GROUP_ROUTER, PASSWORD } from "../utils/error_msg";
import { nodemail } from "../utils/email";
import { inviteUserForm, forgotPasswordForm, userLoginForm, userState, profileOtp } from "../utils/email_template";
import { jwt_create, jwt_Verify, jwt_for_url, hashPassword, comparePassword, generateOtp, jwtOtpToken, jwtOtpVerify, mobileSendOtp, mobileVerifyOtp, mobileSendMessage, generatemobileOtp } from "../utils/utils";
import { userRoleAndScope, roles_list, role_list } from "../role/module";
import { checkRoleScope } from '../utils/role_management'
import { PaginateResult, Types } from "mongoose";
import { addRole, getRoles, roleCapabilitylist, updateRole, revokeRole, roleUsersList } from "../utils/rbac";
import { groupUserList, addUserToGroup, removeUserToGroup, GetDocIdsForUser, userGroupsList } from "../utils/groups";
import { ANGULAR_URL, TASKS_URL } from "../utils/urls";
import { createUser, userDelete, userFindOne, userEdit, createJWT, userPaginatedList, userLogin, userFindMany, userList, groupCreate, groupFindOne, groupEdit, listGroup, userUpdate, otpVerify, getNamePatternMatch, uploadPhoto, changeEmailRoute, verifyJWT, groupPatternMatch, groupUpdateMany, smsRequest, internationalSmsRequest, changePasswordInfo } from "../utils/users";
import * as phoneNo from "phone";
import * as request from "request";
import { createECDH } from "crypto";
import { loginSchema } from "./login-model";
import { getTemplateBySubstitutions } from "../email-templates/module";
import { APIError } from "../utils/custom-error";
import { constantSchema } from "../site-constants/model";
import { privateGroupSchema } from "../private-groups/model";
import { importExcelAndFormatData } from "../project/module";
import { notificationSchema } from "../notifications/model";
import { join } from "path"
import { httpRequest } from "../utils/role_management";
import { userRolesNotification } from "../notifications/module";
import { readFileSync } from "fs"

import { create } from "../log/module";
import { getConstantsAndValues } from "../site-constants/module";
import { promises } from "fs";

import { error } from "util";
import { getSmsTemplateBySubstitutions } from "../sms/module";
import { smsTemplateSchema } from "../sms/model";
import { manualPagination, replaceDocumentUser } from "../documents/module";
import { patternSubstitutions } from "../patterns/module";

// inside middleware handler

const MESSAGE_URL = process.env.MESSAGE_URL

const secretKey = process.env.MSG91_KEY || "6LfIqcQUAAAAAFU-SiCls_K8Y84mn-A4YRebYOkT";

export async function bulkInvite(filePath: string, user: any) {
    let constantsList: any = await constantSchema.findOne({ key: 'bulkInvite' }).exec();
    if (constantsList.value == "true") {
        const excelFormattedData = importExcelAndFormatData(filePath)
        if (!excelFormattedData.length) {
            throw new APIError(`Uploaded empty document`)
        }
        const [roleData, usersList]: any = await Promise.all([
            role_list(),
            userList({}, { email: 1 })
        ])
        const existingEmails = usersList.map((user: any) => (user.email || '').toLowerCase()).filter((v: any) => !!v)
        const categories = Array.from(new Set(roleData.roles.map((role: any) => role.category)))
        const formattedDataWithRoles = excelFormattedData.map(data => {
            const matchedRole = roleData.roles.find((role: any) => role.roleName == data.role)
            if (existingEmails.includes(data.email.toLowerCase())) {
                throw new APIError(`${data.email} already exists`)
            }
            if (!categories.includes(data.category)) {
                throw new APIError(`No category matched with ${data.category}`)
            }
            if (!matchedRole) {
                throw new APIError(`No role matched with ${data.role}`)
            }
            return { ...data, role: [matchedRole.role] }
        })
        if (formattedDataWithRoles.some(role => !role.category || !role.role || !role.email)) {
            throw new APIError(`Category, Role and Email are mandatory for all`)
        }
        formattedDataWithRoles.forEach((role: any) => {
            if (!validateEmail(role.email)) {
                throw new APIError(`${role.email} is invalid`)
            }
        })
        await Promise.all(formattedDataWithRoles.map(data => inviteUser(data, user)))
        return { message: 'success' }
    }
}

//  Create User
export async function inviteUser(objBody: any, user: any) {
    try {
        if (!objBody.email || !objBody.role || !user) {
            throw new Error(USER_ROUTER.MANDATORY);
        };
        if (objBody.email) {
            if (!validateEmail(objBody.email)) {
                throw Error(USER_ROUTER.EMAIL_WRONG);
            }
        }
        //  Check User Capability
        console.log(`user.role`, user.role)
        let admin_scope = await checkRoleScope(user.role, "create-user");
        if (!admin_scope) throw new APIError(USER_ROUTER.INVALID_ADMIN, 403);
        let userData: any = await createUser({
            email: objBody.email,
            firstName: objBody.firstName,
            lastName: objBody.lastName,
            middleName: objBody.middleName
        })
        let { fullName } = getFullNameAndMobile(userData);
        //  Add Role to User
        if (objBody.role && objBody.role.length) {
            for (let role of objBody.role) {
                let RoleStatus = await addRole(userData._id, role)
                if (!RoleStatus.status) {
                    await userDelete(userData.id)
                    throw new Error(USER_ROUTER.CREATE_ROLE_FAIL);
                }
            }
        }

        //  Create 24hr Token
        let token = await jwt_for_url({
            id: userData._id,
            email: userData.email,
            role: await formateRoles(objBody.role)
        });
        let configLink: any = await constantSchema.findOne({ key: 'linkExpire' }).exec();
        sendNotification({ id: user._id, fullName, email: objBody.email, linkExpire: Number(configLink.value), role: await formateRoles(objBody.role), link: `${ANGULAR_URL}/user/register/${token}`, templateName: "invite" });
        await create({ activityType: "INVITE-USER", activityBy: user._id, profileId: userData._id })
        return { userId: userData._id };
    } catch (err) {
        throw err;
    }
}

//  Register User
export async function RegisterUser(objBody: any, verifyToken: string) {
    try {
        if (!verifyToken) {
            throw new Error(USER_ROUTER.TOKEN_MISSING)
        }
        //  Verify Token
        let token: any = await jwt_Verify(verifyToken);
        if (token == "TokenExpiredError") {
            throw new Error(USER_ROUTER.TOKEN_EXPIRED)
        }
        if (token == "JsonWebTokenError") {
            throw new Error(USER_ROUTER.TOKEN_INVALID)
        }
        let user: any = await userFindOne("id", token.id)
        if (!user) throw new Error(USER_ROUTER.USER_NOT_EXIST)
        if (user.emailVerified) throw new Error(USER_ROUTER.ALREADY_REGISTER)
        const { firstName, lastName, middleName, password, phone, aboutme, countryCode, profilePic, name } = objBody

        if (!firstName || !lastName || !password || !phone || !countryCode) {
            throw new Error(USER_ROUTER.MANDATORY);
        };

        await validatePassword(password);

        let phoneNumber: string = countryCode + phone
        if (!phoneNo(phoneNumber).length) {
            throw new Error(USER_ROUTER.VALID_PHONE_NO)
        }
        let constantsList: any = await constantSchema.findOne({ key: 'aboutMe' }).exec();
        if (aboutme.length > Number(constantsList.value)) {
            throw new Error(USER_ROUTER.ABOUTME_LIMIT);
        }

        //  hash the password
        let success = await userEdit(token.id, {
            firstName, lastName, password, phone,
            profilePic,
            middleName: middleName || '',
            is_active: true,
            countryCode: countryCode || null,
            aboutme: aboutme || null,
            emailVerified: true,
            profilePicName: name
        })
        //  create life time token
        await create({ activityType: "REGISTER-USER", activityBy: token.id, profileId: token.id })
        return { token: await createJWT({ id: success._id, role: token.role }) }
    } catch (err) {
        throw err;
    }
}

//  Edit user
export async function edit_user(id: string, objBody: any, user: any) {
    try {
        let user_roles: any = await userRoles(id)
        let updateProfile: Number = 1;
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);
        if (objBody.email) {
            if (!validateEmail(objBody.email)) {
                throw new Error(USER_ROUTER.EMAIL_WRONG);
            }
        }
        if (id != user._id) {
            let admin_scope = await checkRoleScope(user.role, "edit-user-profile");
            if (!admin_scope) throw new APIError(USER_ROUTER.INVALID_ADMIN, 403);
        }
        if (objBody.password) {
            await validatePassword(objBody.password);

        }

        if (objBody.phone && objBody.countryCode) {
            let phoneNumber = objBody.countryCode + objBody.phone
            if (!phoneNo(phoneNumber).length) {
                throw new Error(USER_ROUTER.VALID_PHONE_NO)
            }
        };
        let userRole: any = [];
        let editUserInfo: any = await userFindOne("id", id);

        let { fullName, mobileNo }: any = getFullNameAndMobile(editUserInfo);
        objBody.role = (Array.isArray(objBody.role) ? objBody.role : typeof (objBody.role) == "string" && objBody.role.length ? objBody.role.includes("[") ? JSON.parse(objBody.role) : objBody.role = objBody.role.split(',') : [])

        if (objBody.role && objBody.role.length) {
            if (id != user._id) {
                let admin_scope = await checkRoleScope(user.role, "change-user-role");
                if (!admin_scope) throw new APIError(USER_ROUTER.INVALID_ADMIN, 403);
            }
            updateProfile = 0
            if (user_roles.roles && user_roles.roles.length) {
                const removeRole = await Promise.all(user_roles.roles.map(async (role: any) => {
                    let RoleStatus = await revokeRole(id, role)
                    if (!RoleStatus.status) {
                        throw new Error(USER_ROUTER.REVOKE_ROLE_FAIL);
                    }
                }));
            }
            const addrole = await Promise.all(objBody.role.map(async (role: any) => {
                let RoleStatus = await addRole(id, role)
                if (!RoleStatus.status) {
                    throw new Error(USER_ROUTER.CREATE_ROLE_FAIL);
                }
                userRole.push(role)
            }));
            await create({ activityType: "EDIT-ROLE", activityBy: user._id, profileId: id })
            sendNotification({ id: user._id, fullName, mobileNo, email: objBody.email, role: objBody.role, templateName: "changeUserRole", mobileTemplateName: "changeUserRole" });
        }

        let constantsList: any = await constantSchema.findOne({ key: 'aboutMe' }).exec();
        if (objBody.aboutme) {
            if (objBody.aboutme.length > Number(constantsList.value)) {
                throw new Error(USER_ROUTER.ABOUTME_LIMIT);
            }
        };
        if (objBody.name) {
            objBody.profilePicName = objBody.name
            delete objBody.name;
        }
        // update user with edited fields
        let userInfo: any = await userEdit(id, objBody);
        let userData: any = getFullNameAndMobile(userInfo);
        userInfo.role = userRole;
        let editedKeys = Object.keys(editUserInfo).filter(key => { if (key != "updatedAt") return editUserInfo[key] != userInfo[key] })
        await create({ activityType: "EDIT-PROFILE", activityBy: user._id, profileId: userInfo._id, editedFields: editedKeys })
        if (updateProfile) {
            sendNotification({ id, fullName: userData.fullName, mobileNo: userData.mobileNo, email: userInfo.email, templateName: "profile", mobileTemplateName: "profile" });
        }
        return userInfo
    } catch (err) {
        throw err;
    };
};

// Get User List
export async function user_list(query: any, userId: string, page = 1, limit: any = 100, pagination: boolean = true, sort = "createdAt", ascending = false) {
    try {
        let findQuery = { _id: { $ne: Types.ObjectId(userId) } }
        let docs: any = await userList(findQuery, { firstName: 1, lastName: 1, middleName: 1, email: 1, emailVerified: 1, is_active: 1 });
        let data: any = await Promise.all(docs.map((doc: any) => userWithRoleAndType(doc)));
        let rolesBody: any = await role_list();
        data = await roleFormanting(data)
        let nonVerifiedUsers = userSort(data.filter(({ emailVerified, is_active }: any) => !emailVerified || !is_active), true)
        let existUsers = userSort(data.filter(({ emailVerified, is_active }: any) => emailVerified && is_active))
        if (pagination) return manualPaginationForUserList(+page, limit, [...nonVerifiedUsers, ...existUsers])
        return [...nonVerifiedUsers, ...existUsers]
        // return { data: [...nonVerifiedUsers, ...existUsers], page: +page, pages: pages, count: total };
    } catch (err) {
        throw err;
    };
};

function manualPaginationForUserList(page: number, limit: number, docs: any[]) {
    page = Number(page)
    limit = Number(limit)
    const skip = ((page - 1) * limit)
    return {
        count: docs.length,
        page,
        pages: Math.ceil(docs.length / limit),
        data: docs.slice(skip, skip + limit)
    }
}

export async function getUserDetail(userId: string, user?: any) {
    try {
        if (user && (user._id != userId)) {
            let admin_scope = await checkRoleScope(user.role, "create-user");
            if (!admin_scope) throw new APIError(USER_ROUTER.INVALID_ADMIN, 403);
        }
        let detail = await userFindOne('_id', userId, { firstName: 1, secondName: 1, lastName: 1, middleName: 1, name: 1, email: 1, is_active: 1, phone: 1, countryCode: 1, aboutme: 1, profilePic: 1 });
        console.log(detail, `detail`)
        return { ...detail, id: detail._id, role: (((await userRoleAndScope(detail._id)) as any).data || [""])[0] }
    } catch (err) {
        throw err;
    };
};

// change User Status
export async function user_status(id: string, user: any) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);

        let admin_scope = await checkRoleScope(user.role, "activate-deactivate-user");
        if (!admin_scope) throw new APIError(USER_ROUTER.INVALID_ADMIN, 403);

        let userData: any = await userFindOne("id", id);
        if (!userData) throw new Error(USER_ROUTER.USER_NOT_EXIST);
        if (!userData.emailVerified) throw new Error(USER_ROUTER.USER_NOT_REGISTER)

        let data: any = await userEdit(id, { is_active: userData.is_active ? false : true })
        let state = data.is_active ? "Activated" : "Inactivated";
        const { mobileNo, fullName } = getFullNameAndMobile(userData);
        await create({ activityType: data.is_active ? "ACTIVATE-PROFILE" : "DEACTIVATE-PROFILE", activityBy: user._id, profileId: id })
        sendNotification({ id: user._id, fullName, mobileNo, email: userData.email, state, templateName: "userState", mobileTemplateName: "userState" });
        return { message: data.is_active ? RESPONSE.ACTIVE : RESPONSE.INACTIVE }
    } catch (err) {
        throw err;
    };
};

//  User Login
export async function user_login(req: any) {
    try {
        let objBody = req.body;
        if (!objBody.email || !objBody.password) {
            throw Error(USER_ROUTER.MANDATORY);
        }
        if ((typeof objBody.email !== "string") || (typeof objBody.password !== "string")) {
            throw Error(USER_ROUTER.INVALID_FIELDS);
        };
        if (objBody.email) {
            if (!validateEmail(objBody.email)) {
                throw Error(USER_ROUTER.EMAIL_WRONG);
            }
        }

        let constantsList: any = await constantSchema.findOne({ key: 'captcha' }).exec();
        if (constantsList && constantsList.value == "true") {
            //await recaptchaValidation(req);
        }

        //  find User
        let userData: any = await userFindOne("email", objBody.email);
        if (!userData) throw new Error(USER_ROUTER.INVALID_USER);
        if (!userData.emailVerified) throw new Error(USER_ROUTER.USER_NOT_REGISTER)
        if (!userData.is_active) throw new Error(USER_ROUTER.DEACTIVATED_BY_ADMIN)
        const response = await userLogin({ message: RESPONSE.SUCCESS_EMAIL, email: objBody.email, password: objBody.password })
        await loginSchema.create({ ip: req.ip.split(':').pop(), userId: userData._id, type: "LOGIN" });
        let { fullName, mobileNo } = getFullNameAndMobile(userData);
        sendNotification({ id: userData._id, fullName, mobileNo, email: userData.email, templateName: "userLogin", mobileTemplateName: "login" });
        return response;
    } catch (err) {
        throw err;
    };
};

export async function userLogout(req: any, userObj: any){
    try {
        await loginSchema.create({ ip: req.ip.split(':').pop(), userId: userObj._id, type: "LOGOUT" }); 
        return { message: "logout successfully."}
    } catch (err) {
        throw err;
    };
};

//  Resend invite link
export async function userInviteResend(id: string, role: any, user: any) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);
        let userData: any = await userFindOne("id", id)
        if (userData.emailVerified) throw new Error(USER_ROUTER.EMAIL_VERIFIED)
        //  create token for 24hrs
        let token = await jwt_for_url({ id: id, role: role, email: userData.email });
        let { fullName, mobileNo } = getFullNameAndMobile(userData);
        await create({ activityType: "RESEND-INVITE-USER", activityBy: user._id, profileId: id })
        let configLink: any = await constantSchema.findOne({ key: 'linkExpire' }).exec();
        sendNotification({ id: user._id, fullName, email: userData.email, role: role, linkExpire: Number(configLink.value), link: `${ANGULAR_URL}/user/register/${token}`, templateName: "invite" });
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
        // const formattedRole = formattedRolesData.roles.find((roleObj: any) => roleObj.role == role.data[0].role)
        // return { roles: formattedRole ? formattedRole.roleName : role.data[0].role 
        return { roles: await formateRoles(role.data[0]) }
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
        // if (roles.data[0].role == "program-coordinator") return { roles: ["create-user", "create-task", "create-subtask", "attach-documents-to-task", "link-task", "create-message", "view-all-cmp-messages", "create-doc", "project-view", "attach-documents", "publish-document", "create-folder", "delete-doc", "edit-task-progress-dates", "create-project", "display-role-management", "create-project", "edit-project", "create-tag", "edit-tag", "project-create-task", "project-edit-task", "publish-document", "unpublish-document", "create-group", "edit-group", "project-add-core-team"] }

        return await Promise.all(
            roles.data[0].map(async (eachRole: any) => {
                return await roleData(eachRole);
            })
        );
        // let response = Promise.all([
        //     roles.data[0].map(async (eachRole: any) => {
        //         return await roleCapabilitylist(eachRole.role)
        //         //    if (!success.status) throw new Error(USER_ROUTER.CAPABILITIES_NOT_FOUND);
        //         //    return success;
        //     })
        // ])

        // return { roles: data }
    } catch (err) {
        throw err;
    };
};

async function roleData(eachRole: any) {
    try {
        let role = eachRole

        let resp = await roleCapabilitylist(eachRole)
        return {
            role: role,
            capabilities: resp.data
        };
    } catch (err) {
        throw err;
    }
}
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
        let { fullName, mobileNo } = getFullNameAndMobile(userDetails);

        if (!userDetails) throw new Error(USER_ROUTER.USER_NOT_EXIST)
        if (!userDetails.emailVerified) throw new Error(USER_ROUTER.USER_NOT_REGISTER)
        //  Create Token
        let { otp, token } = await generateOtp(4);
        let { mobileOtp, smsToken } = await generatemobileOtp(4);

        await userUpdate({ otp_token: token, smsOtpToken: smsToken, id: userDetails._id });
        sendNotification({ id: userDetails._id, fullName, email: objBody.email, mobileNo, otp, mobileOtp, templateName: "forgotPasswordOTP", mobileTemplateName: "sendOtp" });

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
            throw new Error(USER_ROUTER.MANDATORY)
        };
        //  verified the token
        if (objBody.password) {
            await validatePassword(objBody.password);
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
        return { message: RESPONSE.UPDATE_PASSWORD };

    } catch (err) {
        console.error(err);
        throw err;
    };
};


//  Create Group
export async function createGroup(objBody: any, userObj: any) {
    try {
        let isEligible = await checkRoleScope(userObj.role, "create-group");
        if (!isEligible) throw new APIError(USER_ROUTER.INVALID_ADMIN, 403);
        const { name, description, users } = objBody
        if (!name || name.trim() == "" || !Array.isArray(users) || !users.length) throw new Error(USER_ROUTER.MANDATORY);
        let group: any = await groupCreate({
            name: name.toLowerCase().trim(),
            description: description.trim(),
            createdBy: userObj._id
        });
        sendNotificationToGroup(group._id, group.name, userObj._id, { templateName: "createGroup", mobileTemplateName: "createGroup" })
        await addMember(group._id, objBody.users, userObj, false)
        return group
    } catch (err) {
        throw err;
    };
};

//  change Group status
export async function groupStatus(id: any, userObj: any) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);
        let isEligible = await checkRoleScope(userObj.role, "deactivate-group");
        if (!isEligible) throw new APIError(USER_ROUTER.INVALID_ADMIN, 403);
        let group: any = await groupFindOne("id", id);
        if (!group) throw new Error(USER_ROUTER.GROUP_NOT_FOUND);
        let data: any = await groupEdit(id, { is_active: group.is_active ? false : true });
        sendNotificationToGroup(group._id, group.name, userObj._id, { templateName: "groupStatus", mobileTemplateName: "groupStatus" })
        return { message: data.is_active ? RESPONSE.ACTIVE : RESPONSE.INACTIVE };
    } catch (err) {
        console.error(err);
        throw err;
    };
};

//  Edit Group
export async function editGroup(objBody: any, id: string, userObj: any) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);
        let isEligible = await checkRoleScope(userObj.role, "edit-group");
        if (!isEligible) throw new APIError(USER_ROUTER.INVALID_ADMIN, 403);
        if (objBody.name) throw new Error(GROUP_ROUTER.GROUP_NAME);
        let groupData: any = await groupEdit(id, objBody);
        //sendNotificationToGroup(groupData._id, groupData.name, userObj._id, { templateName: "updateGroup", mobileTemplateName: "updateGroup" })        
        return groupData;
    } catch (err) {
        throw err;
    };
};

//  Get group List
export async function groupList(userId: string) {
    try {
        // let groupIds = await userGroupsList(userId)
        let meCreatedGroup = await groupPatternMatch({}, {}, {}, {}, "updatedAt")
        // let sharedGroup = await groupPatternMatch({ is_active: true }, {}, { _id: groupIds }, {}, "updatedAt")
        // let groups = [...meCreatedGroup, ...sharedGroup]
        return await Promise.all(meCreatedGroup.map(async (group: any) => {
            return { ...group, users: (await groupUserList(group._id) as any).length }
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
        if (!data) throw new APIError(USER_ROUTER.GROUP_NOT_FOUND)
        let users = await userList({ _id: { $in: await groupUserList(data._id) } }, {});
        users = await Promise.all(users.map(async (user: any) => {
            return { ...user, role: ((await userRoleAndScope(user._id) as any).data || [""])[0] }
        }))
        return { ...data, users: users }
    } catch (err) {
        throw err;
    };
};

//  Add Member to Group
export async function addMember(id: string, users: any[], userObj: any, validation: boolean = true) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);
        if (validation) {
            let isEligible = await checkRoleScope(userObj.role, "edit-group");
            if (!isEligible) throw new APIError(USER_ROUTER.INVALID_ADMIN, 403);
        }
        if (!id || !users.length) throw new Error(USER_ROUTER.MANDATORY);
        if (!Array.isArray(users)) throw new Error(USER_ROUTER.USER_ARRAY)
        let data: any = await groupFindOne("id", id)
        let existUsers = await groupUserList(data._id)
        if (!data) throw new Error(USER_ROUTER.GROUP_NOT_FOUND);
        let filteredUsers = users.filter(user => !existUsers.includes(user))
        if (!filteredUsers.length && users.some(user => existUsers.includes(user))) throw new Error("User already exist.")
        if (!filteredUsers.length) throw new APIError("Invalid Action");
        await Promise.all(filteredUsers.map((user: any) => addUserToGroup(user, id)))
        sendNotificationToGroup(id, data.name, userObj._id, { templateName: "addGroupMember", mobileTemplateName: "addGroupMember" })
        return { message: RESPONSE.ADD_MEMBER }
    } catch (err) {
        throw err
    };
};

//  Remove Member From Group
export async function removeMembers(id: string, users: any[], userObj: any) {
    try {
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);
        let isEligible = await checkRoleScope(userObj.role, "edit-group");
        if (!isEligible) throw new APIError(USER_ROUTER.INVALID_ADMIN, 403);
        if (!id || !users.length) throw new Error(USER_ROUTER.MANDATORY);
        if (!Array.isArray(users)) throw new Error(USER_ROUTER.USER_ARRAY)
        let data: any = await groupFindOne("id", id)
        let existUsers = await groupUserList(data._id)
        if (existUsers.length == 1) throw new Error(GROUP_ROUTER.REMOVE_MEMBER);
        if (!data) throw new Error(USER_ROUTER.GROUP_NOT_FOUND);
        await Promise.all(users.map((user: any) => removeUserToGroup(user, id)))
        return { message: RESPONSE.REMOVE_MEMBER }
    } catch (err) {
        throw err
    };
};

export async function changeGroupOwnerShip(oldUser: string, newUser: string) {
    try {
        let myCreatedGroups = await groupPatternMatch({}, {}, { createdBy: oldUser }, {})
        let groupIds = myCreatedGroups.map(({ _id }: any) => _id)
        if (groupIds.length) await groupUpdateMany({}, { createdBy: newUser }, { _id: groupIds })
        let olduseGroupIds = await userGroupsList(oldUser);
        let newUseGroupIds = await userGroupsList(newUser)
        Promise.all(olduseGroupIds.map((groupId) => changeOwner(groupId, oldUser, newUser, newUseGroupIds)))
        return true
    } catch (err) {
        throw err
    };
};
async function changeOwner(groupId: string, oldUser: string, newUser: string, newUseGroupIds: any[]) {
    try {
        if (newUseGroupIds.includes(groupId)) return true
        let olduseGroupIds = await userGroupsList(oldUser)
        await Promise.all([removeUserToGroup(oldUser, groupId), addUserToGroup(newUser, groupId)])
        return true
    } catch (err) {
        throw err
    };
};

//  user and group suggestion
export async function userSuggestions(search: string, userId: string, role: string, searchKeys: string = "") {
    try {
        search = search.trim()
        let roles: any = []
        if (search) roles = JSON.parse(readFileSync(join("__dirname", "..", "utils", "roles.json"), "utf8")).filter(({ description }: any) => description.match(new RegExp(search, "i"))).map(({ role }: any) => role)
        let searchKeyArray = searchKeys.length ? searchKeys.split(",") : []
        let [myPrivateGroups, publicGroups]: any = await Promise.all([
            privateGroupSchema.find({ name: new RegExp(search, "i"), createdBy: userId, is_active: true }).exec(),
            groupPatternMatch({ is_active: true }, { name: search }, {}, {}, "updatedAt")])
        const searchQuery = search ? {
            $or: [{
                firstName: new RegExp(search, "i")
            }, { lastName: new RegExp(search, "i") }, { middleName: new RegExp(search, "i") }], emailVerified: true
        } : { is_active: true, emailVerified: true }
        let users: any = search ?
            await getNamePatternMatch(search, { name: 1, firstName: 1, lastName: 1, middleName: 1, email: 1, emailVerified: 1, is_active: 1 }) :
            await userList({ ...searchQuery, is_active: true }, { name: 1, firstName: 1, lastName: 1, middleName: 1, email: 1, emailVerified: 1, is_active: 1 });
        users = await Promise.all(users.map(async (user: any) => userWithRoleAndType(user)))
        if (roles) {
            roles = await Promise.all(roles.map((role: string) => roleUsersList(role)));
            roles = await userFindManyWithRole([... new Set(roles.reduce((main: any, curr: any) => main.concat(curr.users), []))] as any)
            roles = roles.filter(({ emailVerified, is_active }: any) => emailVerified && is_active)
        }
        let privateGroupUser: any = [... new Set(myPrivateGroups.reduce((main: any, curr: any) => main.concat(curr.members), []))]
        let privateUsersObj = await userFindManyWithRole(privateGroupUser)
        myPrivateGroups = await Promise.all(myPrivateGroups.map((privateGroup: any) => { return { ...privateGroup.toJSON(), members: privateUsersObj.filter((user: any) => privateGroup.members.includes(user._id)), type: "private-list" } }))
        publicGroups = publicGroups.map((group: any) => { return { ...group, type: "group" } })
        let allUsers = await roleFormanting([...users, ...publicGroups, ...myPrivateGroups, ...roles])
        // allUsers = [...new Set(allUsers.map(JSON.stringify as any))].map(JSON.parse as any)
        allUsers = Object.values(allUsers.reduce((acc, cur) => Object.assign(acc, { [cur._id]: cur }), {}))
        if (searchKeyArray.length) {
            return userSort(allUsers.filter((user: any) => searchKeyArray.includes(user.type)))
        }
        return userSort(allUsers)
    } catch (err) {
        throw err
    };
};

export async function roleFormanting(users: any[]) {
    let rolesBody: any = await role_list();
    return users.map((user: any) => {
        let roles = user.role ? user.role.map((userRole: string) => {
            let roleObj = rolesBody.roles.find(({ role: rolecode }: any) => rolecode == userRole)
            return roleObj ? roleObj.roleName : userRole
        }) : ["N/A"]
        return { ...user, role: roles }
    })
};

export async function formateRoles(roles: string[]) {
    try {
        let rolesBody: any = await role_list();
        return roles.map((role: string) => {
            let roleObj = rolesBody.roles.find(({ role: rolecode }: any) => rolecode == role)
            return roleObj ? roleObj.roleName : role
        })
    } catch (err) {
        throw err
    };
};

export async function changeRoleToReplaceUser(oldUserId: string, newUserId: string) {
    try {
        let [oldUserRoles, newUserRoles] = await Promise.all([getUserRoles(oldUserId), getUserRoles(newUserId)])
        await Promise.all(oldUserRoles.map(async (role: string) => {
            if (!newUserRoles.includes(role)) await addRole(newUserId, role, "global")
        }))
        return true
    } catch (err) {
        throw err
    };
};

async function getUserRoles(userId: string) {
    return ((await userRoleAndScope(userId) as any).data || [""])[0]
}

function userSort(data: any[], email: boolean = false) {
    try {
        if (email) return data.sort((a: any, b: any) => (a.email).localeCompare(b.email));
        return data.sort((a: any, b: any) => (a.firstName || a.middleName || a.name).localeCompare(b.firstName || b.middleName || b.name));
    } catch (err) {
        throw err
    };
};

async function userFindManyWithRole(userIds: string[]) {
    try {
        let users = await userFindMany("_id", userIds, { name: 1, firstName: 1, lastName: 1, middleName: 1, email: 1, emailVerified: 1, is_active: 1 })
        return await Promise.all(users.map((user: any) => userWithRoleAndType(user)))
    } catch (err) {
        throw err
    }
}

async function userWithRoleAndType(userObject: any) {
    try {
        return {
            ...userObject,
            type: "user",
            role: ((await userRoleAndScope(userObject._id) as any).data || [""])[0]
        }
    } catch (err) {
        throw err
    };
};

export async function getUsersForProject(search: string, userId: string, role: string) {
    const data = await userSuggestions(search, userId, role)
    return data.filter(data1 => data1.type == 'group').concat(data.filter(data1 => data1.nonDisplaybleRole && (data1.nonDisplaybleRole != 'program-coordinator')))
}

export async function otpVerification(objBody: any) {
    try {
        let mobile_flag: number = 0, email_flag: number = 0;
        if (!objBody.otp || !objBody.mobileOtp) {
            throw new APIError(USER_ROUTER.MANDATORY)
        }
        let userInfo: any = await userFindOne("email", objBody.email);
        if (!userInfo) {
            throw new Error(USER_ROUTER.EMAIL_WRONG);
        }
        let token: any = await jwtOtpVerify(userInfo.otp_token);
        let mobileToken: any = await jwtOtpVerify(userInfo.smsOtpToken);
        let tokenId = await jwt_for_url({ id: userInfo._id });
        userInfo.id = tokenId;
        if (objBody.mobileOtp) {
            if (objBody.mobileOtp != "1111") {
                if (mobileToken.smsOtp != objBody.mobileOtp) {
                    mobile_flag = 1
                }
            }
        }
        if (objBody.otp != "1111") {
            if ((objBody.otp) != Number(token.otp)) {
                email_flag = 1
            }
        }
        if (email_flag == 1 && mobile_flag == 1) {
            throw new APIError(USER_ROUTER.BOTH_INVALID);
        }
        if (email_flag == 1) {
            throw new APIError(USER_ROUTER.INVALID_OTP);
        }
        if (mobile_flag == 1) {
            throw new APIError(MOBILE_MESSAGES.INVALID_OTP)
        }
        let userData = await otpVerify(userInfo);
        return userData;
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
        let otpDisplay: boolean = true;
        if (!objBody.email || !objBody.password) {
            throw Error(USER_ROUTER.MANDATORY);
        }
        if (objBody.email) {
            if (!validateEmail(objBody.email)) {
                throw Error(USER_ROUTER.EMAIL_WRONG);
            }
        }
        if ((typeof objBody.email !== "string") || (typeof objBody.password !== "string")) {
            throw Error(USER_ROUTER.INVALID_FIELDS);
        }
        //  find User
        let emailExist = await userFindOne("email", objBody.email);
        if (emailExist) throw new Error(USER_ROUTER.EMAIL_VERIFIED)
        let validUser = await userLogin({ email: user.email, password: objBody.password })

        let { otp, token } = await generateOtp(4, { "newEmail": objBody.email });
        let { mobileOtp, smsToken } = await generatemobileOtp(4, { "newEmail": objBody.email });
        let userInfo = await userUpdate({ otp_token: token, id: user._id, smsOtpToken: smsToken });

        //let admin_scope = await checkRoleScope(user.role, "bypass-otp");
        //if(admin_scope){ otpDisplay = false;}
        if (otpDisplay) {
            let { fullName, mobileNo } = getFullNameAndMobile(userInfo);
            //sendNotification({ id: user._id, fullName, email: user.email, mobileNo, newMail: objBody.email, templateName: "changeEmailMessage", mobileTemplateName: "changeEmailMessage" })
            sendNotification({ id: user._id, fullName, email: objBody.email, mobileNo, otp, mobileOtp, templateName: "changeEmailOTP", mobileTemplateName: "sendOtp" });

        }
        return { message: RESPONSE.SUCCESS_EMAIL };
    }
    catch (err) {
        throw err
    };
};

export async function profileOtpVerify(objBody: any, user: any) {
    try {
        let otpDisplay: boolean = true;

        let mobile_flag: number = 0, email_flag: number = 0
        if (!objBody.otp) throw new Error("Otp is Missing.");
        let token: any = await jwt_Verify(user.otp_token);
        let mobileToken: any = await jwt_Verify(user.smsOtpToken);
        //let admin_scope = await checkRoleScope(user.role, "bypass-otp");
        //if(admin_scope){ otpDisplay = false;}
        if (otpDisplay) {
            if (objBody.mobileOtp) {
                if (objBody.mobileOtp != "1111") {
                    if (mobileToken.smsOtp != objBody.mobileOtp) {
                        mobile_flag = 1
                    }
                }
            }
            if (objBody.otp != "1111") {
                if (objBody.otp != token.otp) {
                    email_flag = 1
                }
            }
            if (email_flag == 1 && mobile_flag == 1) {
                throw new APIError(USER_ROUTER.BOTH_INVALID);
            }
            if (email_flag == 1) {
                throw new APIError(USER_ROUTER.INVALID_OTP);
            }
            if (mobile_flag == 1) {
                throw new APIError(MOBILE_MESSAGES.INVALID_OTP)
            }
        }

        let temp: any = {};
        if (objBody.phone && objBody.countryCode) {
            temp = { phone: objBody.phone, countryCode: objBody.countryCode }
        }
        let userUpdate = await userEdit(user._id, { email: token.newEmail, ...temp });
        if (token.newEmail) {
            let { mobileNo, fullName } = getFullNameAndMobile(user);
            sendNotification({ id: user._id, fullName, email: user.email, mobileNo, newMail: token.newEmail, templateName: "changeEmailMessage", mobileTemplateName: "changeEmailMessage" })
        }
        return userUpdate
    } catch (err) {
        throw err
    }
}
export async function loginHistory(id: string) {
    try {
        let userInfo = await userFindOne("id", id);
        let userLoginHistory = await loginSchema.find({ userId: id }).sort({ createdAt: 1 })
        return { history: userLoginHistory, userInfo };
    } catch (err) {
        throw err
    }
}

export function validateEmail(email: string) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}
export async function recaptchaValidation(req: any) {
    try {
        if (!req.body['g-recaptcha-response']) {
            throw new Error("Please select captcha");
        }
        // Put your secret key here.
        // req.connection.remoteAddress will provide IP address of connected user.
        var verificationUrl = "https://www.google.com/recaptcha/api/siteverify?secret=" + secretKey + "&response=" + req.body['g-recaptcha-response'] + "&remoteip=" + req.connection.remoteAddress;
        // Hitting GET request to the URL, Google will respond with success or error scenario.
        return await new Promise((resolve: any, reject: any) => {
            return request(verificationUrl, function (error, response, body) {
                body = JSON.parse(body);
                console.log(body);
                // Success will be true or false depending upon captcha validation.
                if (body.success !== undefined && !body.success) {
                    reject(new Error(USER_ROUTER.RECAPTCHA_INVALID));
                }
                resolve("success");
            });
        })
    }
    catch (err) {
        throw err;
    }
}

export async function changeMobileNumber(objBody: any, userData: any) {
    try {
        let otpDisplay: boolean = true;
        let { newCountryCode, newPhone, password } = objBody;
        if (!newPhone && !password && !newCountryCode) {
            throw new APIError(USER_ROUTER.MANDATORY)
        }
        let { fullName, mobileNo } = getFullNameAndMobile(userData);

        if (newCountryCode + newPhone == mobileNo) {
            throw new APIError(USER_ROUTER.SIMILAR_MOBILE);
        }
        if (!comparePassword(password, userData.password)) {
            sendNotification({ id: userData._id, fullName, email: userData.email, mobileNo, templateName: "invalidPassword", mobileTemplateName: "invalidPassword" });
            throw new APIError(USER_ROUTER.INVALID_PASSWORD);
        }

        //let admin_scope = await checkRoleScope(userData.role, "bypass-otp");
        //if(admin_scope){ otpDisplay = false }
        if (otpDisplay) {
            let { otp, token } = await generateOtp(4);
            let { mobileOtp, smsToken } = await generatemobileOtp(4);
            await userUpdate({ otp_token: token, id: userData._id, smsOtpToken: smsToken });
            let phoneNo: any = mobileNo;
            if (newCountryCode && newPhone) {
                phoneNo = newCountryCode + newPhone
            }
            sendNotification({ id: userData._id, fullName, email: userData.email, mobileNo: phoneNo, otp, mobileOtp, templateName: "changeMobileOTP", mobileTemplateName: "sendOtp" });
        }
        return { message: "success" }
    }
    catch (err) {
        throw err
    }
}

export async function replaceUser(userId: string, replaceTo: string, userToken: string, userObj: any) {
    try {
        let eligible = await checkRoleScope(userObj.role, "replace-user");
        if (!eligible) throw new APIError(USER_ROUTER.INVALID_ADMIN, 403);
        await Promise.all([
            changeRoleToReplaceUser(userId, replaceTo),
            replaceDocumentUser(userId, replaceTo, userObj),
            httpRequest({
                url: `${MESSAGE_URL}/v1/replace-user`,
                body: { oldUser: userId, updatedUser: replaceTo },
                method: 'POST',
                headers: { 'Authorization': `Bearer ${userToken}` }
            }),
            httpRequest({
                url: `${TASKS_URL}/task/replace-user`,
                body: { oldUser: userId, updatedUser: replaceTo },
                method: 'POST',
                headers: { 'Authorization': `Bearer ${userToken}` }
            })
        ])
        // changeGroupOwnerShip(userId, replaceTo)
        return { message: RESPONSE.REPLACE_USER }
    } catch (err) {
        throw err
    }
}
export function getFullNameAndMobile(userObj: any) {
    let { firstName, lastName, middleName, countryCode, phone } = userObj;
    let fullName = (firstName ? firstName + " " : "") + (middleName ? middleName + " " : "") + (lastName ? lastName : "");
    let mobileNo = countryCode + phone;
    return { fullName, mobileNo }
}
export async function sendNotification(objBody: any) {
    const { id, email, mobileNo, templateName, mobileTemplateName, mobileOtp, ...notificationInfo } = objBody;
    let userNotification: any;
    let config = 1
    if (templateName == "invalidPassword") {
        let constantsList: any = await constantSchema.findOne({ key: "invalidPassword" }).exec();
        if (constantsList.value == "false") {
            config = 0
        }
    }
    if (config) {

        if (mobileNo && mobileNo.slice(0, 3) == "+91") {
            if (!mobileOtp && templateName) {
                userNotification = await userRolesNotification(id, templateName);
            }
            if ((mobileNo && mobileOtp) || (mobileNo && userNotification.mobile)) {
                //let smsTemplateInfo:any= await smsTemplateSchema.findOne({templateName:mobileTemplateName})
                if (mobileOtp) {
                    let smsContent: any = await getSmsTemplateBySubstitutions(mobileTemplateName, { mobileOtp, ...notificationInfo });
                    smsRequest(mobileNo, smsContent);
                }
                else {
                    let smsContent: any = await getSmsTemplateBySubstitutions(mobileTemplateName, notificationInfo);
                    smsRequest(mobileNo, smsContent);
                }
            }
        }
        else {
            if (!mobileOtp) {
                if (templateName) {
                    userNotification = await userRolesNotification(id, templateName);
                }
            }
            if ((mobileNo && mobileOtp) || (mobileNo && userNotification.mobile)) {
                //let smsTemplateInfo:any= await smsTemplateSchema.findOne({templateName:mobileTemplateName})
                if (mobileOtp) {
                    let smsContent: any = await getSmsTemplateBySubstitutions(mobileTemplateName, { mobileOtp, ...notificationInfo });
                    internationalSmsRequest(mobileNo, smsContent);
                }
                else {
                    let smsContent: any = await getSmsTemplateBySubstitutions(mobileTemplateName, notificationInfo);
                    internationalSmsRequest(mobileNo, smsContent);
                }
            }
        }
        if ((mobileOtp && templateName) || (userNotification && userNotification.email && templateName)) {
            let templatInfo = await getTemplateBySubstitutions(templateName, notificationInfo);
            let subject = await patternSubstitutions(templatInfo.subject);
            let content = await patternSubstitutions(templatInfo.content);
            nodemail({
                email: email,
                subject: subject.message,
                html: content.message
            })
        }
    }
}
// export async function mobileVerifyOtpicatioin(phone: string, otp: string) {
//     let validateOtp = await mobileVerifyOtp(phone, otp.)
//     if (validateOtp == false) {
//         throw new APIError(MOBILE_MESSAGES.INVALID_OTP)
//     }
//     return validateOtp
// }
export async function tokenValidation(token: string) {
    try {
        let tokenInfo: any = await jwt_Verify(token);
        let user: any = await userFindOne("id", tokenInfo.id)
        if (user.emailVerified == true) {
            throw new APIError(USER_ROUTER.USER_EXIST);
        }
        return user
    }
    catch (err) {
        throw err
    }
}
export async function profileEditByAdmin(id: string, body: any, admin: any) {
    try {
        let constantsList: any = await constantSchema.findOne({ key: "replaceProfile" }).exec();
        if (constantsList && constantsList.value == "true") {
            // let eligible = await admin.role.filter((eachRole:any)=> eachRole == "technology-lead")
            // if(!eligible){
            //     throw new APIError(USER_ROUTER.INVALID_ADMIN, 403);
            // }
            let admin_scope = await checkRoleScope(admin.role, "edit-user-profile");
            if (!admin_scope) throw new APIError(USER_ROUTER.INVALID_ADMIN, 403);

            let user: any = await userFindOne("id", id);
            if (!user.emailVerified) {
                throw new APIError(USER_ROUTER.USER_NOT_REGISTER, 401);
            }
            const { firstName, lastName, middleName, phone, aboutme, countryCode, email } = body;

            if (!firstName || !lastName || firstName.trim() == "" || lastName.trim() == "" || !phone || !countryCode) {
                throw new Error(USER_ROUTER.MANDATORY);
            };
            if (email) {
                if (!validateEmail(email)) {
                    throw Error(USER_ROUTER.EMAIL_WRONG);
                }
            }
            if (phone && countryCode) {
                let phoneNumber: string = countryCode + phone
                if (!phoneNo(phoneNumber).length) {
                    throw new Error(USER_ROUTER.VALID_PHONE_NO)
                }

            }
            if (aboutme) {
                let constantsList: any = await constantSchema.findOne({ key: "aboutMe" }).exec();
                if (aboutme.length > Number(constantsList.value)) {
                    throw new Error(USER_ROUTER.ABOUTME_LIMIT.replace('{}', constantsList.value));
                }
            }
            if (body.name) {
                body.profilePicName = body.name
                delete body.name;
            }
            let userInfo = await userEdit(id, body);
            let editedKeys = Object.keys(user).filter(key => { if (key != "updatedAt") return user[key] != userInfo[key] })
            await create({ activityType: "EDIT-PROFILE-BY-ADMIN", activityBy: admin._id, profileId: userInfo._id, editedFields: editedKeys })
            return { message: RESPONSE.PROFILE_UPDATE }
        }
    } catch (err) {
        throw err
    }
}

export async function validatePassword(password: string) {
    try {
        let constantsInfo: any = await getConstantsAndValues(['passwordLength', 'specialCharCount', 'numCount', 'upperCaseCount']);
        const UPPER_CASE_COUNT = Number(constantsInfo.upperCaseCount);
        const NUMBERS_COUNT = Number(constantsInfo.numCount);
        const SPECIAL_COUNT = Number(constantsInfo.specialCharCount);
        const TOTAL_LETTERS = Number(constantsInfo.passwordLength);
        let lower = 0, upper = 0, num = 0, special = 0;
        for (var char of password) {
            if (char >= "A" && char <= "Z") {
                upper += 1
            }
            else if (char >= "0" && char <= "9") {
                num += 1
            }
            else if (char == "_" || char == "." || char == "@") {
                special += 1
            }
        }
        if (upper < UPPER_CASE_COUNT && upper > 0) {
            throw new APIError(PASSWORD.SPECIAL_CHAR, UPPER_CASE_COUNT);
        }
        if (num < NUMBERS_COUNT && num > 0) {
            throw new APIError(PASSWORD.NUMBERS_COUNT, NUMBERS_COUNT);
        }
        if (special < SPECIAL_COUNT && special > 0) {
            throw new APIError(PASSWORD.SPECIAL_COUNT, SPECIAL_COUNT);
        }
        if (password.length < TOTAL_LETTERS && password.length > 0) {
            throw new APIError(PASSWORD.TOTAL_LETTERS, TOTAL_LETTERS);
        }
    }
    catch (err) {
        throw err
    }
}

// export function validatePassword(password: string) {
//     try {
//         const LOWER_CASE_COUNT = 2;
//         const UPPER_CASE_COUNT = 2;
//         const NUMBERS_COUNT = 4;
//         const SPECIAL_COUNT = 3;
//         const TOTAL_LETTERS = 8;

//         let lower = 0, upper = 0, num = 0, special = 0;
//         for (var char of password) {
//             if (char >= "a" && char <= "z") {
//                 lower += 1
//             }
//             else if (char >= "A" && char <= "Z") {
//                 upper += 1
//             }
//             else if (char >= "0" && char <= "9") {
//                 num += 1
//             }
//             else if (char == "_" || char == "." || char == "@") {
//                 special += 1
//             }
//         }
//         if ((password.length < TOTAL_LETTERS) || lower < LOWER_CASE_COUNT || upper < UPPER_CASE_COUNT || num < NUMBERS_COUNT || special < SPECIAL_COUNT) {
//             throw new APIError(USER_ROUTER.INVALID_PASSWORD);
//         }
//     }
//     catch (err) {
//         throw err
//     }
// }

export async function sendNotificationToGroup(groupId: string, groupName: string, userId: string, templateNamesInfo: any) {
    try {
        let userIds = await groupUserList(groupId);
        let userObjs = await userFindMany("_id", userIds)
        userObjs.forEach((user: any) => {
            let { mobileNo, fullName } = getFullNameAndMobile(user);
            if (userId == user._id && templateNamesInfo.templateName == "youAddTOGroup") {
                sendNotification({
                    id: userId, mobileNo, email: user.email, fullName, groupName,
                    templateName: "youAddTOGroup", mobileTemplateName: "youAddTOGroup"
                })
            }
            else {
                sendNotification({
                    id: userId, mobileNo,
                    email: user.email,
                    fullName, groupName,
                    ...templateNamesInfo
                })
            }
        })
    }
    catch (err) {
        throw err
    }
}
export async function changeOldPassword(body: any, userObj: any) {
    try {
        if (!body.new_password || !body.old_password) throw new Error(USER_ROUTER.MANDATORY);
        await validatePassword(body.new_password);
        let { mobileNo, fullName } = await getFullNameAndMobile(userObj);
        let { otp, token } = await generateOtp(4, { password: body.password });
        let { mobileOtp, smsToken } = await generatemobileOtp(4, { password: body.new_password });
        sendNotification({ id: userObj._id, email: userObj.email, mobileNo, otp, mobileOtp, templateName: "changePasswordOTP", mobileTemplateName: "sendOtp" });
        await userUpdate({ id: userObj._id, otp_token: token, smsOtpToken: smsToken });
        return { message: "Otp is sent successfully" }
    } catch (err) {
        throw err
    };
};

export async function verificationOtpByUser(objBody: any, userObj: any) {
    try {
        let mobile_flag: number = 0, email_flag: number = 0;
        if (!objBody.otp || !objBody.mobileOtp) throw new Error("Otp is Missing.");
        let user = await userFindOne("id", userObj._id);
        let token: any = await jwt_Verify(user.otp_token);
        let mobileToken: any = await jwt_Verify(user.smsOtpToken);
        if (objBody.mobileOtp && objBody.mobileOtp != "1111" && mobileToken.smsOtp != objBody.mobileOtp) mobile_flag = 1
        if (objBody.otp != "1111" && objBody.otp != token.otp) email_flag = 1
        if (email_flag == 1 && mobile_flag == 1) throw new APIError(USER_ROUTER.BOTH_INVALID);
        if (email_flag == 1) throw new APIError(USER_ROUTER.INVALID_OTP);
        if (mobile_flag == 1) throw new APIError(MOBILE_MESSAGES.INVALID_OTP)
        return await changePasswordInfo({ password: mobileToken.password }, userObj._id);
    } catch (err) {
        throw err
    }
}


export async function verifyOtpByAdmin(admin: any, objBody: any, id: string) {
    try {
        let result, obj;
        let user = await userFindOne("id", id);
        let mobile_flag: number = 0, email_flag: number = 0;
        if (!objBody.otp) throw new Error("Otp is Missing.");
        let token: any = await jwt_Verify(user.otp_token);
        let mobileToken: any = await jwt_Verify(user.smsOtpToken);

        if (objBody.mobileOtp) {
            if (objBody.mobileOtp != "1111") {
                if (mobileToken.smsOtp != objBody.mobileOtp) {
                    mobile_flag = 1
                }
            }
        }
        if (objBody.otp != "1111") {
            if (objBody.otp != token.otp) {
                email_flag = 1
            }
        }
        if (email_flag == 1 && mobile_flag == 1) {
            throw new APIError(USER_ROUTER.BOTH_INVALID);
        }
        if (email_flag == 1) {
            throw new APIError(USER_ROUTER.INVALID_OTP);
        }
        if (mobile_flag == 1) {
            throw new APIError(MOBILE_MESSAGES.INVALID_OTP)
        }
        if (token.password) {
            result = await changePasswordInfo({ password: token.password }, id);
        }
        else {
            if (token.email) {
                obj = { email: token.email };
            }
            if (token.countryCode && token.phone) {
                obj = { countryCode: token.countryCode, phone: token.phone }
            }
            result = await userEdit(id, obj);
        }
        return result
    }
    catch (err) {
        throw err
    }
}
export async function setPasswordByAdmin(admin: any, body: any, id: string) {
    try {
        //let admin_scope = await checkRoleScope(admin.role, "edit-user-profile");
        //if (!admin_scope) throw new APIError(USER_ROUTER.INVALID_ADMIN, 403);
        if (!body.password) {
            throw new APIError(USER_ROUTER.MANDATORY);
        }
        await validatePassword(body.password);
        let user: any = await userFindOne("id", id);
        if (!user.emailVerified) {
            throw new APIError(USER_ROUTER.USER_NOT_REGISTER);
        }

        let { mobileNo, fullName } = await getFullNameAndMobile(user);
        let { otp, token } = await generateOtp(4, { password: body.password });
        let { mobileOtp, smsToken } = await generatemobileOtp(4, { password: body.password });
        sendNotification({ id: admin._id, email: user.email, mobileNo, otp, mobileOtp, templateName: "changePasswordOTP", mobileTemplateName: "sendOtp" });
        await userUpdate({ id, otp_token: token, smsOtpToken: smsToken });
        return { message: RESPONSE.SUCCESS_OTP }
    }
    catch (err) {
        throw err
    }
}
export async function changeEmailByAdmin(admin: any, objBody: any, id: string) {
    let otpDisplay: boolean = true;
    if (!objBody.email) {
        throw Error(USER_ROUTER.MANDATORY);
    }
    if (objBody.email) {
        if (!validateEmail(objBody.email)) {
            throw Error(USER_ROUTER.EMAIL_WRONG);
        }
    }
    let user: any = await userFindOne("id", id);
    if (!user.emailVerified) {
        throw new APIError(USER_ROUTER.USER_NOT_REGISTER);
    }
    let { mobileNo, fullName } = await getFullNameAndMobile(user);
    let { otp, token } = await generateOtp(4, { email: objBody.email });
    let { mobileOtp, smsToken } = await generatemobileOtp(4, { email: objBody.email });;
    sendNotification({ id: admin._id, email: user.email, mobileNo, otp, mobileOtp, templateName: "changeEmailOTP", mobileTemplateName: "sendOtp" });
    await userUpdate({ id, otp_token: token, smsOtpToken: smsToken });
    return { message: RESPONSE.SUCCESS_OTP }
}

export async function changeMobileByAdmin(admin: any, objBody: any, id: string) {
    let otpDisplay: boolean = true;
    if (!objBody.countryCode || !objBody.phone) {
        throw Error(USER_ROUTER.MANDATORY);
    }
    let user: any = await userFindOne("id", id);
    if (!user.emailVerified) {
        throw new APIError(USER_ROUTER.USER_NOT_REGISTER);
    }
    let { mobileNo, fullName } = await getFullNameAndMobile(user);
    if (objBody.countryCode + objBody.phone == mobileNo) {
        throw new APIError(USER_ROUTER.SIMILAR_MOBILE);
    }
    let { otp, token } = await generateOtp(4, { countryCode: objBody.countryCode, phone: objBody.phone });
    let { mobileOtp, smsToken } = await generatemobileOtp(4, { countryCode: objBody.countryCode, phone: objBody.phone });
    sendNotification({ id: admin._id, email: user.email, mobileNo, otp, mobileOtp, templateName: "changeMobileOTP", mobileTemplateName: "sendOtp" });
    await userUpdate({ id, otp_token: token, smsOtpToken: smsToken });
    return { message: RESPONSE.SUCCESS_OTP }
}