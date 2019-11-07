import { constantSchema } from "./model"
import { constants } from "perf_hooks";

export async function addConstants(objBody:any) {
    try{
        let constantsData = await constantSchema.findOneAndUpdate({},{$set:objBody},{new:true}).exec();
        return constantsData
    }
    catch(err){
        throw err
    }

}
export async function constantsList() {
    try{
        let constantsData = await constantSchema.findOne().exec()
        return constantsData
    }
    catch(err){
        throw err
    }

}