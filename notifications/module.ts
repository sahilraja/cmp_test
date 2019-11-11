import { notificationSchema } from "./model";
import { APIError } from "../utils/custom-error";
import { USER_ROUTER, ROLE_NOT_EXIST } from "../utils/error_msg";
import { role_list } from "../role/module";
import { TemplateSchema } from "../email-templates/model";

export async function notificationsUpdate(reqObject: any) {
    try {
        let { role, templateName, email, mobile } = reqObject;
        let updatedData = await notificationSchema.update({ 'role': role, "templates.templateName": templateName },
            { $set: { 'templates.$.mobile': email, 'templates.$.email': mobile } })
        return updatedData
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
export async function addTemplateNotification(templateName: any) {
    try {
        // let templateList: any = await TemplateSchema.find({ templateName }).exec();
        // if (!templateList) {
        //     throw new APIError("Template is not found in email templates");
        // }
        return await notificationSchema.update({}, { "$push": { templates: { templateName, email: false, mobile: false } } })
    }
    catch (err) {
        throw err
    }
}