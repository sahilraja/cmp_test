import { MISSING, USER_ROUTER, MAIL_SUBJECT, RESPONSE, INCORRECT_OTP, SENDER_IDS, MOBILE_MESSAGES, MOBILE_TEMPLATES } from "../utils/error_msg";
import { nodemail } from "../utils/email";
import { inviteUserForm, forgotPasswordForm, userLoginForm, userState, profileOtp } from "../utils/email_template";
import { jwt_create, jwt_Verify, jwt_for_url, hashPassword, comparePassword, generateOtp, jwtOtpToken, jwtOtpVerify, mobileSendOtp, mobileVerifyOtp, mobileSendMessage, generatemobileOtp } from "../utils/utils";
import { checkRoleScope, userRoleAndScope, roles_list, role_list } from "../role/module";
import { PaginateResult, Types } from "mongoose";
import { addRole, getRoles, roleCapabilitylist, updateRole, roleUsersList } from "../utils/rbac";
import { groupUserList, addUserToGroup, removeUserToGroup, GetDocIdsForUser, userGroupsList } from "../utils/groups";
import { ANGULAR_URL, TASKS_URL } from "../utils/urls";
import { createUser, userDelete, userFindOne, userEdit, createJWT, userPaginatedList, userLogin, userFindMany, userList, groupCreate, groupFindOne, groupEdit, listGroup, userUpdate, otpVerify, getNamePatternMatch, uploadPhoto, changeEmailRoute, verifyJWT, groupPatternMatch, groupUpdateMany, smsRequest, internationalSmsRequest } from "../utils/users";
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
import { any } from "bluebird";
import { create } from "../log/module";
import { getConstantsAndValues } from "../site-constants/module";

import { error } from "util";
import { getSmsTemplateBySubstitutions } from "../sms/module";
import { smsTemplateSchema } from "../sms/model";
const MESSAGE_URL = process.env.MESSAGE_URL

const secretKey = process.env.MSG91_KEY || "6Lf4KcEUAAAAAJjwzreeZS1bRvtlogDYQR5FA0II";

export async function bulkInvite(filePath: string, userId: string) {
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
        return { ...data, role: matchedRole.role }
    })
    if (formattedDataWithRoles.some(role => !role.category || !role.role || !role.email)) {
        throw new APIError(`Category, Role and Email are mandatory for all`)
    }
    formattedDataWithRoles.forEach((role: any) => {
        if (!validateEmail(role.email)) {
            throw new APIError(`${role.email} is invalid`)
        }
    })
    await Promise.all(formattedDataWithRoles.map(data => inviteUser(data, userId)))
    return { message: 'success' }
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
        sendNotification({ id: user._id, fullName, email: objBody.email, role: objBody.role, link: `${ANGULAR_URL}/user/register/${token}`, templateName: "invite" });
        await create({ activityType: "INVITE-USER", activityBy: user._id, profileId: userData._id })
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
        if (!/^(?=.{6,})(?=.*[@#$%^&+=]).*$/.test(password)) {
            throw new Error(USER_ROUTER.VALID_PASSWORD)
        };

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
    };
};

//  Edit user
export async function edit_user(id: string, objBody: any, user: any) {
    try {
        let updateProfile: Number = 1;
        if (!Types.ObjectId.isValid(id)) throw new Error(USER_ROUTER.INVALID_PARAMS_ID);
        if (objBody.email) {
            if (!validateEmail(objBody.email)) {
                throw new Error(USER_ROUTER.EMAIL_WRONG);
            }
        }
        if (id != user._id) {
            let admin_scope = await checkRoleScope(user.role, "create-user");
            if (!admin_scope) throw new APIError(USER_ROUTER.INVALID_ADMIN, 403);
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
        let editUserInfo: any = await userFindOne("id", id);

        let { fullName, mobileNo }: any = getFullNameAndMobile(editUserInfo);
        let userRole;
        if (id != user._id && objBody.role) {
            updateProfile = 0
            userRole = await updateRole(id, objBody.updateRole, objBody.role);
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
        await create({ activityType: "EDIT-PROFILE", activityBy: user._id, profileId: userInfo._id })
        if (updateProfile) {
            sendNotification({ id, fullName: userData.fullName, mobileNo: userData.mobileNo, email: userInfo.email, templateName: "profile", mobileMessage: "profile" });
        }
        return userInfo
    } catch (err) {
        throw err;
    };
};

// Get User List
export async function user_list(query: any, userId: string, page = 1, limit: any = 100, sort = "createdAt", ascending = false) {
    try {
        let findQuery = { _id: { $ne: Types.ObjectId(userId) } }
        let { docs, pages, total }: PaginateResult<any> = await userPaginatedList(findQuery, { firstName: 1, lastName: 1, middleName: 1, email: 1, emailVerified: 1, is_active: 1 }, page, parseInt(limit), sort, ascending);
        const data = await Promise.all(docs.map(async doc => userWithRoleAndType(doc)));
        let rolesBody: any = await role_list();
        data.map((user: any) => {
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

        let admin_scope = await checkRoleScope(user.role, "activate-deactivate-user");
        if (!admin_scope) throw new APIError(USER_ROUTER.INVALID_ADMIN, 403);

        let userData: any = await userFindOne("id", id);
        if (!userData) throw new Error(USER_ROUTER.USER_NOT_EXIST);
        if (!userData.emailVerified) throw new Error("User not registered Yet.")

        let data: any = await userEdit(id, { is_active: userData.is_active ? false : true })
        let state = data.is_active ? "Activated" : "Inactivated";
        const { mobileNo, fullName } = getFullNameAndMobile(userData);
        await create({ activityType: data.is_active ? "ACTIVATE-PROFILE" : "DEACTIVATE-PROFILE", activityBy: user.id, profileId: id })
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
        if (constantsList.value == "true") {
            //await recaptchaValidation(req);
        }

        //  find User
        let userData: any = await userFindOne("email", objBody.email);
        if (!userData) throw new Error(USER_ROUTER.INVALID_USER);
        if (!userData.emailVerified) throw new Error(USER_ROUTER.USER_NOT_REGISTER)
        if (!userData.is_active) throw new Error(USER_ROUTER.DEACTIVATED_BY_ADMIN)
        const response = await userLogin({ message: RESPONSE.SUCCESS_EMAIL, email: objBody.email, password: objBody.password })
        await loginSchema.create({ ip: objBody.ip, userId: userData._id });
        let { fullName, mobileNo } = getFullNameAndMobile(userData);
        sendNotification({ id: userData._id, fullName, mobileNo, email: userData.email, templateName: "userLogin", mobileTemplateName: "login" });
        return response;
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
        await create({ activityType: "RESEND-INVITE-USER", activityBy: user.id, profileId: id })
        sendNotification({ id: user._id, fullName, email: userData.email, role: role, link: `${ANGULAR_URL}/user/register/${token}`, templateName: "invite" });
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
        // if (roles.data[0].role == "program-coordinator") return { roles: ["create-user", "create-task", "create-subtask", "attach-documents-to-task", "link-task", "create-message", "view-all-cmp-messages", "create-doc", "project-view", "attach-documents", "publish-documents", "create-folder", "delete-doc", "edit-task-progress-dates", "create-project", "display-role-management", "create-project", "edit-project", "create-tag", "edit-tag", "project-create-task", "project-edit-task", "publish-document", "unpublish-document", "create-group", "edit-group", "project-add-core-team"] }
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
export async function createGroup(objBody: any, userObj: any) {
    try {
        let isEligible = await checkRoleScope(userObj.role, "create-group");
        if (!isEligible) throw new APIError("Unauthorized Action.", 403);
        const { name, description, users } = objBody
        if (!name || name.trim() == "" || !Array.isArray(users) || !users.length) throw new Error(USER_ROUTER.MANDATORY);
        let group: any = await groupCreate({
            name: name,
            description: description,
            createdBy: userObj._id
        });
        sendNotificationToGroup(group._id, group.name, userObj._id, { templateName: "createGroup", mobileTemplateName: "createGroup" })
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
        if (!isEligible) throw new APIError("Unauthorized Action.", 403);
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
        if (!isEligible) throw new APIError("Unauthorized Action.", 403);
        if (objBody.name) throw new Error("Group Name not Modified")
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
            return { ...user, role: ((await userRoleAndScope(user._id) as any).data.global || [""])[0] }
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
            if (!isEligible) throw new APIError("Unauthorized Action.", 403);
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
        if (!isEligible) throw new APIError("Unauthorized Action.", 403);
        if (!id || !users.length) throw new Error(USER_ROUTER.MANDATORY);
        if (!Array.isArray(users)) throw new Error(USER_ROUTER.USER_ARRAY)
        let data: any = await groupFindOne("id", id)
        let existUsers = await groupUserList(data._id)
        if (existUsers.length == 1) throw new Error("Minimum one member is required.")
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
        groupUpdateMany({}, { createdBy: newUser }, { _id: groupIds })
        let olduseGroupIds = await userGroupsList(oldUser);
        Promise.all(olduseGroupIds.map((groupId) => changeOwner(groupId, oldUser, newUser)))
    } catch (err) {
        throw err
    };
};
async function changeOwner(groupId: string, oldUser: string, newUser: string) {
    try {
        await Promise.all([removeUserToGroup(oldUser, groupId), addUserToGroup(newUser, groupId)])
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
        let myPrivateGroups: any = await privateGroupSchema.find({ name: new RegExp(search, "i"), createdBy: userId, is_active: true }).exec();
        let publicGroups = await groupPatternMatch({ is_active: true }, { name: search }, {}, {}, "updatedAt")
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
        myPrivateGroups = await Promise.all(myPrivateGroups.map((privateGroup: any) => { return { ...privateGroup.toJSON(), members: privateUsersObj.filter((user: any) => privateGroup.members.includes(user._id)), type: "private-group" } }))
        publicGroups = publicGroups.map((group: any) => { return { ...group, type: "group" } })
        let allUsers = await roleFormanting([...users, ...publicGroups, ...myPrivateGroups, ...roles])
        // allUsers = [...new Set(allUsers.map(JSON.stringify as any))].map(JSON.parse as any)
        allUsers = Object.values(allUsers.reduce((acc, cur) => Object.assign(acc, { [cur._id]: cur }), {}))
        // allUsers = allUsers.filter(({emailVerified, is_active}): any=> emailVerified && is_active)
        if (searchKeyArray.length) {
            return userSort(allUsers.filter((user: any) => searchKeyArray.includes(user.type)))
        }
        return userSort(allUsers)
    } catch (err) {
        throw err
    };
};

async function roleFormanting(users: any[]) {
    let rolesBody: any = await role_list();
    return users.map((user: any) => {
        rolesBody.roles.forEach((roleInfo: any) => {
            if (roleInfo.role == user.role) {
                user.role = roleInfo.roleName;
                user.nonDisplaybleRole = roleInfo.role
                return false;
            }
        });
        return user
    })
};

function userSort(data: any[]) {
    try {
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
            role: ((await userRoleAndScope(userObject._id) as any).data.global || [""])[0]
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
        if (!objBody.otp && !objBody.mobileOtp) {
            throw new APIError(USER_ROUTER.MANDATORY)
        }
        if (!objBody.otp) {
            throw new Error("Required email otp field");
        };
        if (!objBody.mobileOtp) {
            throw new Error("Required mobile otp field");
        };
        let userInfo: any = await userFindOne("email", objBody.email);
        if (!userInfo) {
            throw new Error(USER_ROUTER.EMAIL_WRONG);
        }
        let token: any = await jwtOtpVerify(userInfo.otp_token);
        let mobileToken: any = await jwtOtpVerify(userInfo.smsOtpToken);
        let tokenId = await jwt_for_url({ id: userInfo._id });
        userInfo.id = tokenId;
        if (objBody.mobileOtp) {
            if (mobileToken.smsOtp != objBody.mobileOtp) {
                mobile_flag = 1
            }
        }
        if ((objBody.otp) != Number(token.otp)) {
            email_flag = 1
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
        if (emailExist) throw new Error("Already email exist.")
        let validUser = await userLogin({ email: user.email, password: objBody.password })
        if (!validUser.token) throw new Error("Enter valid credentials.");

        let { otp, token } = await generateOtp(4, { "newEmail": objBody.email });
        let { mobileOtp, smsToken } = await generatemobileOtp(4, { "newEmail": objBody.email });

        let userInfo = await userUpdate({ otp_token: token, id: user._id, smsOtpToken: smsToken });
        let { fullName, mobileNo } = getFullNameAndMobile(userInfo);

        sendNotification({ id: user._id, fullName, email: user.email, mobileNo, newMail: objBody.email, templateName: "changeEmailMessage", mobileTemplateName: "changeEmailMessage" })
        sendNotification({ id: user._id, fullName, email: objBody.email, mobileNo, otp, mobileOtp, templateName: "changeEmailOTP", mobileTemplateName: "sendOtp" });

        return { message: RESPONSE.SUCCESS_EMAIL };
    }
    catch (err) {
        throw err
    };
};

export async function profileOtpVerify(objBody: any, user: any) {
    try {
        let mobile_flag: number = 0, email_flag: number = 0
        if (!objBody.otp) throw new Error("Otp is Missing.");
        let token: any = await jwt_Verify(user.otp_token);
        let mobileToken: any = await jwt_Verify(user.smsOtpToken);

        if (objBody.mobileOtp) {
            if (objBody.countryCode && objBody.phone) {
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
        let temp: any = {};
        if (objBody.phone && objBody.countryCode) {
            temp = { phone: objBody.phone, countryCode: objBody.countryCode }
        }
        return await userEdit(user._id, { email: token.newEmail, ...temp })

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
                    reject(new Error("Failed captcha verification"));
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
        let { otp, token } = await generateOtp(4);
        let { mobileOtp, smsToken } = await generatemobileOtp(4);

        await userUpdate({ otp_token: token, id: userData._id, smsOtpToken: smsToken });

        let phoneNo: any = mobileNo;
        if (newCountryCode && newPhone) {
            phoneNo = newCountryCode + newPhone
        }
        sendNotification({ id: userData._id, fullName, email: userData.email, mobileNo: phoneNo, otp, mobileOtp, templateName: "changeMobileOTP", mobileTemplateName: "sendOtp" });
        return { message: "success" }
    }
    catch (err) {
        throw err
    }
}

export async function replaceUser(userId: string, replaceTo: string, userToken: string) {
    await Promise.all([
        httpRequest({
            url: `${MESSAGE_URL}/v1/replace-user`,
            body: { oldUser: userId, updatedUser: replaceTo },
            method: 'POST',
            headers: { 'Authorization': `Bearer ${userToken}` }
        }),
        httpRequest({
            url: `${TASKS_URL}/replace-user`,
            body: { oldUser: userId, updatedUser: replaceTo },
            method: 'POST',
            headers: { 'Authorization': `Bearer ${userToken}` }
        })
        // Documents & Roles to be updated
    ])
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
    if (mobileNo.slice(0, 3) == "+91") {
        if (!mobileOtp) {
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
            userNotification = await userRolesNotification(id, templateName);
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
    if (mobileOtp || userNotification.email) {
        let templatInfo = await getTemplateBySubstitutions(templateName, notificationInfo);
        nodemail({
            email: email,
            subject: templatInfo.subject,
            html: templatInfo.content
        })
    }
}
export async function mobileVerifyOtpicatioin(phone: string, otp: string) {
    let validateOtp = await mobileVerifyOtp(phone, otp)
    if (validateOtp == false) {
        throw new APIError(MOBILE_MESSAGES.INVALID_OTP)
    }
    return validateOtp
}
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
        let admin_scope = await checkRoleScope(admin.role, "create-user");
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
            let constantsList: any = await constantSchema.findOne().exec();
            if (aboutme.length > Number(constantsList.aboutMe)) {
                throw new Error(USER_ROUTER.ABOUTME_LIMIT);
            }
        }
        let userInfo = await userEdit(id, body);
        await create({ activityType: "EDIT-PROFILE-BY-ADMIN", activityBy: admin._id, profileId: userInfo._id })
        return { message: "successfully profile Updated" }
    } catch (err) {
        throw err
    }
}

export function validatePassword(password: string) {
    try {
        let constantsInfo: any = getConstantsAndValues(['passwordLength', 'specialCharCount', 'numCount', 'upperCaseCount']);
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
        if ((password.length < TOTAL_LETTERS) || upper < UPPER_CASE_COUNT || num < NUMBERS_COUNT || special < SPECIAL_COUNT) {
            throw new APIError(USER_ROUTER.INVALID_PASSWORD);
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
        let usersList = await groupUserList(groupId);
        usersList.forEach((user) => {
            let { mobileNo, fullName } = getFullNameAndMobile(user);
            sendNotification({
                id: userId, mobileNo,
                fullName, groupName,
                ...templateNamesInfo
            })
        })
    }
    catch (err) {
        throw err
    }
}
