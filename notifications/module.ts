import { notificationSchema } from "./model";
import { APIError } from "../utils/custom-error";
import { USER_ROUTER, ROLE_NOT_EXIST } from "../utils/error_msg";
import { role_list } from "../role/module";
import { TemplateSchema } from "../email-templates/model";
import { getRoles } from "../utils/rbac";
import { userDetails } from "../users/module";

export async function notificationsUpdate(reqObject: any) {
    try {
        let { role, templateName, displayName, email, mobile } = reqObject;
        let updatedData = await notificationSchema.update({ 'role': role, "templates.templateName": templateName },
            { $set: { 'templates.$.displayName': displayName, 'templates.$.mobile': mobile, 'templates.$.email': email } })
        return { message: "success" }
    }
    catch (err) {
        throw err
    }
}

export async function addRoleNotification(roleName: any) {
    try {
        // let {roles}:any= await role_list();
        // roles.filter((user:any)=>{
        //     return user.role == roleName
        // })
        // if(roles.length){
        //     throw new Error(ROLE_NOT_EXIST);
        // }
        let existingRoll = await notificationSchema.find({ role: roleName }).count().exec();
        if (existingRoll) {
            throw new APIError(USER_ROUTER.CREATE_ROLE_NOTIFICATION_FAIL);
        }
        let templateList: any = await TemplateSchema.find({}).exec();

        let templates: object[] = [];
        templateList.forEach((template: any) => {
            templates.push({
                templateName: template.templateName,
                displayName: template.displayName,
                email: false,
                mobile: false
            })
        })
        return await notificationSchema.create({ role: roleName, templates });

    }
    catch (err) {
        throw err
    }
}
export async function addTemplateNotification(objBody: any) {
    try {
        const {templateName,displayName} = objBody;
        // let templateList: any = await TemplateSchema.find({ templateName }).exec();
        // if (!templateList) {
        //     throw new APIError("Template is not found in email templates");
        // }
        return await notificationSchema.update({}, { "$push": { templates: { templateName, displayName, email: false, mobile: false } } })
    }
    catch (err) {
        throw err
    }
}

export async function getRoleNotification(roleName: string, templateName: string) {
    try {
        //let notificationInfo:any = await notificationSchema.aggregate([{$match:{ role: roleName}},{$unwind : "$templates"},{ $replaceRoot: { newRoot:{ $mergeObjects: [ { email: "$email", mobile:"$mobile",role:"$role"}, "$templates" ] }} }])
        let notificationInfo: any = await notificationSchema.findOne({ role: roleName }).exec();
        let [getNotification]: any = notificationInfo.templates.filter((notif: any) => {
            return notif.templateName == templateName
        })
        return { role: roleName, ...getNotification }
    }
    catch (err) {
        throw err
    }
}


export async function userRolesNotification(userId: any, templateName: string) {
    try {
        let { data } = await getRoles(userId);
        let roleInfo: any = await Promise.all(data.map(async (user: any) => {
            return await getRoleNotification(user.role, templateName);
        }))
        //return roleInfo
        let notificationResult: any = roleInfo.reduce((acc: any, roleObj: any) => {
            if (roleObj.email == false) {
                acc['email'] = false
            }
            if (roleObj.email == false) {
                acc['mobile'] = false
            }
            return acc
        }, { email: true, mobile: true });
        return notificationResult;
    }
    catch (err) {
        throw err
    }
}