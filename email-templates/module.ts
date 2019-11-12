import {TemplateSchema} from "./model"; 
import { USER_ROUTER } from "../utils/error_msg";
import * as marked from "marked";
import { SUBSTITUTIONS } from "./substitutions";

export async function templateCreate(body: any) {
    try {
        if(!body.content || !body.templateName){
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

export async function templateEdit(body: any,id:string) {
    try {
        let objBody: any={};
        if(body.content){
            objBody.content=body.content;
        }
        if(body.templateName){
            delete body.templateName
        }
        if(body.subject){
            objBody.subject = body.subject;
        }
        let templateCreate  = await TemplateSchema.findByIdAndUpdate(id,{$set:objBody},{new:true});
        return templateCreate;
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
export async function templateGet(id:string) {
    try {
        let template  = await TemplateSchema.findById(id);
        return template;
    } catch (err) {
        throw err
    };
};

export async function getTemplateBySubstitutions(templateId: string, substitutions: any): Promise<{ subject: string, content: string }> {
    try {
        var template:any = await TemplateSchema.findOne({templateName: templateId}).exec();
    } catch( err) {
        throw err;
    }
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
    };
}