import {TemplateSchema} from "./model"; 
import { USER_ROUTER } from "../utils/error_msg";


export async function templateCreate(body: any) {
    try {
        if(!body.content || !body.templateName){
            throw new Error(USER_ROUTER.MANDATORY);
        }
        let objBody = {
            content :body.content,
            templateName : body.templateName,
            subject : body.subject || null
        }
        let templateCreate  = await TemplateSchema.create(objBody);
        return templateCreate;
    } catch (err) {
        throw err
    };
};

export async function templateEdit(body: any,id:string) {
    try {
        let objBody: any={};
        if(body.content){
            objBody.content=body.content;
        }
        if(body.templateName){
            objBody.templateName = body.templateName; 
        }
        if(body.subject){
            objBody.subject = body.subject;
        }
        let templateCreate  = await TemplateSchema.findByIdAndUpdate(id,objBody,{new:true});
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
