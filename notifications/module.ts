import { notificationSchema } from "./model";
import { APIError } from "../utils/custom-error";
import { USER_ROUTER, ROLE_NOT_EXIST, NOTIFICATION, RESPONSE } from "../utils/error_msg";
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
        return { message: RESPONSE.NOTIFICATION_UPDATED_SUCCESS, status: true}
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
                mobile: false,
                category: template.category || null
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
        let templateList: any = await TemplateSchema.findOne({ templateName }).exec();
        if (!templateList) {
            throw new APIError(NOTIFICATION.TEMPLATE_NOT_FOUND);
        }
        return await notificationSchema.updateMany({}, { "$push": { templates: { templateName, displayName, email: true, mobile: true } } })
    }
    catch (err) {
        throw err
    }
}
// Old Code

// export async function getRoleNotification(roleName: string, templateName: string) {
//     try {
//         //let notificationInfo:any = await notificationSchema.aggregate([{$match:{ role: roleName}},{$unwind : "$templates"},{ $replaceRoot: { newRoot:{ $mergeObjects: [ { email: "$email", mobile:"$mobile",role:"$role"}, "$templates" ] }} }])
//         let notificationInfo: any = await notificationSchema.findOne({ role: roleName }).exec();
//         notificationInfo = notificationInfo.toObject();
//         let [userTemplateInfo]: any = notificationInfo.templates.filter((notif: any) => {
//             return notif.templateName == templateName
//         })
//         let {mobile,email} = userTemplateInfo;
//         return { role: roleName,templateName, mobile,email }
//     }
//     catch (err) {
//         throw err
//     }
// }


// export async function userRolesNotification(userId: any, templateName: string) {
//     try {
//         let { data } = await getRoles(userId);
//         let roleInfo: any = await Promise.all(data.map(async (role: any) => {
//             return await getRoleNotification(role, templateName);
//         }))
//         //return roleInfo
//         let notificationResult: any = roleInfo.reduce((acc: any, roleObj: any) => {
//             if (roleObj.email == true) {
//                 acc['email'] = true
//             }
//             if (roleObj.mobile == true ) {
//                 acc['mobile'] = true
//             }
//             return acc
//         }, { email: false, mobile: false });
//         return notificationResult;
//     }
//     catch (err) {
//         throw err
//     }
// }

export async function getRoleNotification(roleName: string, templateName: string) {
    try {
        if(Array.isArray(roleName)){
            var notificationInfo: any = await notificationSchema.find({ role: {$in: roleName} }).exec();
        } else {
            var notificationInfo: any = await notificationSchema.find({ role: roleName }).exec();
        }
        let roleInfo = notificationInfo.map((info: any) => {
            return info.templates.find((template: any) => {
                return template.templateName == templateName
            })
        })
        return roleInfo.reduce((acc: any, roleObj: any) => {
            if (roleObj && (roleObj.email == true)) {
                acc['email'] = true
            }
            if (roleObj && roleObj.mobile == true ) {
                acc['mobile'] = true
            }
            return acc
        }, { email: false, mobile: false });
    }
    catch (err) {
        throw err
    }
}


export async function userRolesNotification(userId: any, templateName: string) {
    try {
        let { data } = await getRoles(userId);
        let roleInfo: any = await Promise.all(data.map(async (role: any) => {
            return await getRoleNotification(role, templateName);
        }))
        return roleInfo[0]
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

export async function getNotificationsNew() {
    const notifications: any[] = await notificationSchema.find({}).exec()
    const notificationScenariosList:any = notifications[0].templates.reduce((p:string[], template:any) => [...p, ({template:template.displayName || template.templateName,category:template.category})] ,[])
    let notificationScenarios = notificationScenariosList.reduce((response:any, template:any) => {
        response[template.category] = response[template.category] || [];
        response[template.category].push(template);
        return response;
    }, Object.create(null));
    return {data: notifications, notificationScenarios}
}

export async function notificationsUpdateNew(reqObject: any) {
    try {
        if(!reqObject.data && reqObject.data.length==0){
            throw new APIError(USER_ROUTER.MANDATORY);
        }
        let updateInfo= await Promise.all(reqObject.data.map(async(roleObj:any)=>{
            if(!roleObj.role || (!roleObj.templates && roleObj.templates.length == 0)){
                throw new APIError(USER_ROUTER.MANDATORY);
            }
            return await notificationSchema.update({'role':roleObj.role},{$set:{ templates: roleObj.templates}})
        }))
        return { message: "Updated successfully", status: true}
        }
    catch (err) {
        throw err
    }
}