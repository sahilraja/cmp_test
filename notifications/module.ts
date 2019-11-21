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
        const oldInfo = await getRoleNotification(role, templateName);
        if(typeof(mobile) === 'undefined'){
            mobile = oldInfo.mobile;
        }
        if(typeof(email) === 'undefined'){
            email = oldInfo.email;
        }
        let updatedData = await notificationSchema.update({ 'role': role, "templates.templateName": templateName },
            { $set: { 'templates.$.displayName': displayName, 'templates.$.mobile': mobile, 'templates.$.email': email } })
        return { message: "success", status: true}
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
                email: true,
                mobile: true
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
        let templateList: any = await TemplateSchema.find({ templateName }).exec();
        if (!templateList) {
            throw new APIError("Template is not found in email templates");
        }
        return await notificationSchema.updateMany({}, { "$push": { templates: { templateName, displayName, email: true, mobile: true } } })
    }
    catch (err) {
        throw err
    }
}

export async function getRoleNotification(roleName: string, templateName: string) {
    try {
        //let notificationInfo:any = await notificationSchema.aggregate([{$match:{ role: roleName}},{$unwind : "$templates"},{ $replaceRoot: { newRoot:{ $mergeObjects: [ { email: "$email", mobile:"$mobile",role:"$role"}, "$templates" ] }} }])
        let notificationInfo: any = await notificationSchema.findOne({ role: roleName }).exec();
        notificationInfo = notificationInfo.toObject();
        let [userTemplateInfo]: any = notificationInfo.templates.filter((notif: any) => {
            return notif.templateName == templateName
        })
        let {mobile,email} = userTemplateInfo;
        return { role: roleName,templateName, mobile,email }
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
            if (roleObj.email == false || roleObj.email == true) {
                acc['email'] = true
            }
            if (roleObj.mobile == false || roleObj.mobile == true ) {
                acc['mobile'] = true
            }
            return acc
        }, { email: false, mobile: false });
        return notificationResult;
    }
    catch (err) {
        throw err
    }
}

export async function getNotifications() {
    const notifications: any[] = await notificationSchema.find({}).exec()
    const notificationScenarios = notifications[0].templates.reduce((p:string[], template:any) => [...p, (template.displayName || template.templateName)] ,[])
    return {data: notifications, notificationScenarios}
}