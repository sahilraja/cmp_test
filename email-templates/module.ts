import {TemplateSchema} from "./model"; 
import { USER_ROUTER, TEMPLATE } from "../utils/error_msg";
import * as marked from "marked";
import { SUBSTITUTIONS } from "./substitutions";
import { nodemail } from "../utils/email";
import { checkRoleScope } from "../utils/role_management";
import { APIError } from "../utils/custom-error";
import { constantSchema } from "../site-constants/model";
import { validateEmail } from "../users/module";

export async function templateCreate(body: any) {
    try {
        if(!body.content || !body.templateName || !body.displayName){
            throw new Error(USER_ROUTER.MANDATORY);
        }
        let templateCreate  = await TemplateSchema.create(body);
        return templateCreate;
    } catch (err) {
        throw err
    };
};

export async function list() {
    return await TemplateSchema.find({}).collation({ locale: 'en' }).sort({ templateName: 1 }).exec()
}

export async function templateEdit(user:any,body: any,id:string) {
    try {
        let constantsList: any = await constantSchema.findOne({ key: 'editTemplate' }).exec();
        if(constantsList.value == "true")
        {
            const isEligible = await checkRoleScope(user.role,"edit-template");
            if (!isEligible) throw new APIError(USER_ROUTER.INVALID_ADMIN, 403);
            let objBody: any = {};
            if(body.content){
                objBody.content=body.content;
            }
            if(body.displayName){
                objBody.displayName = body.displayName;
            }
            if(body.subject){
                objBody.subject = body.subject;
            }
            let templateCreate  = await TemplateSchema.findByIdAndUpdate(id,{$set:objBody},{new:true});
            return templateCreate;
        }
    } catch (err) {
        throw err
    };
};
export async function templateDelete(body: any,id:string) {
    try {
        let templateCreate  = await TemplateSchema.findByIdAndRemove(id);
        return {message: "Template deleted successfully"};
    } catch (err) {
        throw err
    };
};
export async function templateGet(user:any,id:string) {
    try {
        const isEligible = await checkRoleScope(user.role,"display-template-management");
        if (!isEligible) throw new APIError(USER_ROUTER.INVALID_ADMIN, 403);
        let template  = await TemplateSchema.findById(id);
        return template;
    } catch (err) {
        throw err
    };
};

export async function testTemplate(id:string, email: any){
    let template:any  = await TemplateSchema.findById(id);
    let templatInfo = await getTemplateBySubstitutions(template.templateName,{});
    if(!validateEmail(email)) throw new Error(USER_ROUTER.VALID_EMAIL)
    nodemail({
        email: email,
        subject: templatInfo.subject,
        html: templatInfo.content
    })
    return {message:"Email sent successfully"}
}
function formatRole(roles: string[]){
    return [roles.slice(0,-1).join(`, `), roles.slice(-1)[0]].join(roles.length < 2 ? '' : ' & ')
}
export async function getTemplateBySubstitutions(templateId: string, substitutions?: any): Promise<{ subject: string, content: string }> {
    try {
        console.log("getTemplateBySubstitutions",templateId);
        
        var template:any = await TemplateSchema.findOne({templateName: templateId}).exec();
        if (!template) {
            throw new APIError(TEMPLATE.INVALID_TEMPLATE+` ${templateId}`);
        }
        if(!substitutions){
            substitutions = {};
        }
        if(substitutions.role && Array.isArray(substitutions.role)){
            substitutions.role = formatRole(substitutions.role)
        }
        return {
            subject: Object.keys(substitutions).reduce((prev, key) => {
                return prev.replace(new RegExp(`\\[${key}\\]`, "g"), substitutions[key]);
            }, template.subject),
            content: `<style type="text/css">p{margin-bottom:1em;}</style>${template.form == "html" ? 
            
            Object.keys(substitutions).reduce((prev, key) => {
                return prev.replace(new RegExp(`\\[${key}\\]`, "g"), substitutions[key]);
            }, template.content) : 

            marked( Object.keys(substitutions).reduce((prev, key) => {
                return prev.replace(new RegExp(`\\[${key}\\]`, "g"), substitutions[key]);
            }, template.content))}`
        }
    }
    catch( err) {
        throw err;
    }
}