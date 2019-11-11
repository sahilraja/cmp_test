import { phaseSchema } from "./model";
import { APIError } from "../utils/custom-error";
import { userDetails } from "../users/module";
import { USER_ROUTER } from "../utils/error_msg";


export async function createPhase(payload: any) {
    try{
        if(!payload.phaseName && !payload.colorCode){
            throw new APIError(USER_ROUTER.MANDATORY)
        }
        return await phaseSchema.create(payload);
    }
    catch(err){
        throw err
    }
}

export async function editPhase(phaseName: string,colorCode: string) {
    try{
        await phaseSchema.update({phaseName:phaseName}, { $set: {colorCode:colorCode}},{new:true}).exec()
        return {messsage : "success"}
    }
    catch(err){
        throw err
    }
}

export async function getPhase(phaseName:string) {
    try{
        return await phaseSchema.findOne({phaseName}).exec();
    }
    catch(err){
        throw err
    }
}

export async function deletePhase(phaseName:string) {
    try{
        await phaseSchema.deleteOne({phaseName}).exec();
        return {messsage : "successfully deleted phase"}
    }
    catch(err){
        throw err
    }
}
export async function listPhase() {
    try{
        return await phaseSchema.find().exec();
    }
    catch(err){
        throw err
    }
}