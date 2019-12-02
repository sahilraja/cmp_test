import {TemplateSchema} from "./model"; 
import { USER_ROUTER } from "../utils/error_msg";
import * as marked from "marked";
import { SUBSTITUTIONS } from "./substitutions";
import { nodemail } from "../utils/email";
import { checkRoleScope } from "../utils/role_management";
import { APIError } from "../utils/custom-error";
import { constantSchema } from "../site-constants/model";

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
    return await TemplateSchema.find({}).exec()
}

export async function templateEdit(user:any,body: any,id:string) {
    try {
        let constantsList: any = await constantSchema.findOne({ key: 'editTemplate' }).exec();
        if(constantsList.value == "true")
        {
            const isEligible = await checkRoleScope(user.role,"edit-template");
            if (!isEligible) throw new APIError("Unautherized Action.", 403);
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
        return {message: "Successfully deleted template"};
    } catch (err) {
        throw err
    };
};
export async function templateGet(user:any,id:string) {
    try {
        const isEligible = await checkRoleScope(user.role,"display-template-management");
        if (!isEligible) throw new APIError("Unautherized Action.", 403);
        let template  = await TemplateSchema.findById(id);
        return template;
    } catch (err) {
        throw err
    };
};
export async function testTemplate(id:string,user: any){
    let template:any  = await TemplateSchema.findById(id);
    let templatInfo = await getTemplateBySubstitutions(template.templateName);
    nodemail({
        email: user.email,
        subject: templatInfo.subject,
        html: templatInfo.content
    })
}
export async function getTemplateBySubstitutions(templateId: string, substitutions?: any): Promise<{ subject: string, content: string }> {
    try {
        var template:any = await TemplateSchema.findOne({templateName: templateId}).exec();
        if (!template) {
            throw new Error(`Invalid email template ${templateId}`);
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