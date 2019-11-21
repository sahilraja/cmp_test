import { constantSchema } from "./model"
import { constants } from "perf_hooks";

export async function addConstants(objBody:any) {
    try{
        let constantsData:any = await constantSchema.findOneAndUpdate({},{$set:objBody},{new:true}).exec();
        let {createdAt,updatedAt,__v,_id,...constantResult} = constantsData.toObject();
        return constantResult
    }
    catch(err){
        throw err
    }

}
export async function constantsList() {
    try{
        let constantsData :any= await constantSchema.findOne().exec()
        let {createdAt,updatedAt,__v,_id,...constantResult} = constantsData.toObject();
        return Object.keys(constantResult).map((ele)=>{
            return {
                key:ele,
                displayName: ele.split(/(?=[A-Z])/).map(key => key.charAt(0).toUpperCase()+key.slice(1)).join(' '),
                value:constantResult[ele]
            }
        })
        
    }
    catch(err){
        throw err
    }

}