import { phaseSchema } from "./model";
import { APIError } from "../utils/custom-error";
import { userDetails } from "../users/module";
import { USER_ROUTER } from "../utils/error_msg";


export async function createPhase(payload: any,createdBy:string) {
    try{
        if(!payload.phaseName && !payload.colorCode){
            throw new APIError(USER_ROUTER.MANDATORY)
        }
        let phaseInfo:any = await phaseSchema.create({...payload,createdBy});
        let {disable,...phaseResult} =phaseInfo.toObject();
        return phaseResult
    }
    catch(err){
        throw err
    }
}

export async function editPhase(phaseId: string,body: any) {
    try{
        let phaseInfo:any = await phaseSchema.findByIdAndUpdate(phaseId, { $set: {phaseName:body.phaseName,colorCode:body.colorCode}},{new:true}).exec()
        let {disable,...phaseResult} =phaseInfo.toObject();
        return phaseResult
    }
    catch(err){
        throw err
    }
}

export async function getPhase(phaseId:string) {
    try{
        let phaseInfo:any = await phaseSchema.findById(phaseId).exec();
        let {disable,...phaseResult} =phaseInfo.toObject();
        return phaseResult
    }
    catch(err){
        throw err
    }
}

export async function deletePhase(phaseId:string) {
    try{
        await phaseSchema.findByIdAndUpdate(phaseId,{disable:true}).exec();
        return {messsage : "successfully deleted phase"}
    }
    catch(err){
        throw err
    }
}
export async function listPhase() {
    try{
        return await phaseSchema.find({}).exec();
    }
    catch(err){
        throw err
    }
}
export async function userListPhase(userId:string){
    try{
        return await phaseSchema.findById({createdBy:userId}).exec();
    }
    catch(err){
        throw err
    }
}