import {smsTemplateSchema} from "./model"; 
import { USER_ROUTER } from "../utils/error_msg";
import * as marked from "marked";
import { APIError } from "../utils/custom-error";

export async function smsTemplateCreate(body: any) {
    try {
        if(!body.content || !body.templateName || !body.displayName){
            throw new Error(USER_ROUTER.MANDATORY);
        }
        let templateCreate  = await smsTemplateSchema.create(body);
        return templateCreate;
    } catch (err) {
        throw err
    };
};

export async function list() {
    return await smsTemplateSchema.find({}).exec()
}

export async function smsTemplateEdit(body: any,id:string) {
    try {
        let objBody: any={};
        if(body.content){
            objBody.content=body.content;
        }
        if(body.displayName){
            objBody.displayName = body.displayName;
        }
        if(body.subject){
            objBody.subject = body.subject;
        }
        let templateCreate  = await smsTemplateSchema.findByIdAndUpdate(id,{$set:objBody},{new:true});
        return templateCreate;
    } catch (err) {
        throw err
    };
};
export async function smsTemplateDelete(body: any,id:string) {
    try {
        let templateCreate  = await smsTemplateSchema.findByIdAndRemove(id);
        return {message: "Template deleted successfully"};
    } catch (err) {
        throw err
    };
};
export async function smsTemplateGet(id:string) {
    try {
        let template  = await smsTemplateSchema.findById(id);
        return template;
    } catch (err) {
        throw err
    };
};

export async function getSmsTemplateBySubstitutions(templateId: string, substitutions: any): Promise<{ subject: string, content: string }> {
    try {
        var template:any = await smsTemplateSchema.findOne({templateName: templateId}).exec();
    } catch( err) {
        throw err;
    }
    if (!template) {
        throw new APIError(USER_ROUTER.INVALID_EMAIL_TEMP);
    }
    let smsContnet:any =Object.keys(substitutions).reduce((prev, key) => {
            return prev.replace(new RegExp(`\\[${key}\\]`, "g"), substitutions[key]);
        }, template.content)
    
    return smsContnet;
}