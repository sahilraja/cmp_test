import { constantSchema } from "./model"
import { constants } from "perf_hooks";
import { APIError } from "../utils/custom-error";
import { USER_ROUTER, UNAUTHORIZED_ACTION } from "../utils/error_msg";
import { checkRoleScope } from '../utils/role_management'
import { userRoleAndScope } from "../role/module";

export async function createConstant(objBody: any,userId: string) {
    let userRoles = await userRoleAndScope(userId);
    let userRole = userRoles.data[0];
    const isEligible = await checkRoleScope(userRole, "view-edit-configurations");
        if (!isEligible) {
        throw new APIError(UNAUTHORIZED_ACTION, 403);
    }
    return await constantSchema.create(objBody)
}

export async function addConstants(objBody:any, userId: string) {
    try{
        let userRoles = await userRoleAndScope(userId);
        let userRole = userRoles.data[0];
        const isEligible = await checkRoleScope(userRole, "view-edit-configurations");
            if (!isEligible) {
            throw new APIError(UNAUTHORIZED_ACTION, 403);
        }
        let constantValue
        const keys = Object.keys(objBody)
        if([undefined, null, ''].includes(objBody[keys[0]])){
            throw new  APIError(USER_ROUTER.MANDATORY);
        }
        let constantInfo :any = await constantSchema.findOne({key:keys[0]});
        if (constantInfo.type && constantInfo.type == "boolean") {
            if (objBody[keys[0]] == "true"){  constantValue = "true" }
            else if(objBody[keys[0]] == "false"){ constantValue = "false"}
            else{
                throw new APIError(USER_ROUTER.CONSTANT_INVALID);
            }
        }
        if (constantInfo.type && constantInfo.type == "number" ) {
            if (Number(objBody[keys[0]]) == objBody[keys[0]] && Number(objBody[keys[0]])>=0) { constantValue = Number(objBody[keys[0]])}
            else{
                throw new APIError(USER_ROUTER.CONSTANT_INVALID);
             }
        }
        let constantsData:any = await constantSchema.findOneAndUpdate({key:keys[0]},{$set:{value:objBody[keys[0]]}},{new:true}).exec();
        return constantsData
    }
    catch(err){
        throw err
    }

}
export async function constantsList() {
    try{
        // let userRoles = await userRoleAndScope(userId);
        // let userRole = userRoles.data[0];
        // const isEligible = await checkRoleScope(userRole, "view-edit-configurations");
        //     if (!isEligible) {
        //     throw new APIError("Unauthorized for this Action", 403);
        // }
        return await constantSchema.find({}).exec()
    }
    catch(err){
        throw err
    }
}

export async function getConstantsGroupBy(){
    const data:any = await constantSchema.find({}).exec();
    let ans = data.reduce((p: any,c: any) => {
        c = c.toObject();
        if(p[c.groupName]){
            p[c.groupName].push(c)
        } else {
            p[c.groupName] = [c]
        }
        return p
    } ,{})
    return ans
}

export async function getConstantsAndValues(constKeys:string[]) { 
    try{
    const constantInfo = await constantSchema.find({}).exec();
    let result = constantInfo.reduce((prev:any,current:any)=>{
        if(constKeys.includes(current.key)){
            prev[current.key] =  current.value;
        }
        return prev;
    },{});
    return result;
    }
    catch(err){
        throw err;
    }
}