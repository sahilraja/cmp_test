import { constantSchema } from "./model"
import { constants } from "perf_hooks";

export async function createConstant(objBody: any) {
    return await constantSchema.create(objBody)
}

export async function addConstants(objBody:any) {
    try{
        const keys = Object.keys(objBody)
        let constantsData:any = await constantSchema.findOneAndUpdate({key:keys[0]},{$set:{value:objBody[keys[0]]}},{new:true}).exec();
        return constantsData
    }
    catch(err){
        throw err
    }

}
export async function constantsList() {
    try{
        return await constantSchema.find({}).exec()
    }
    catch(err){
        throw err
    }
}

export async function getConstantsGroupBy(){
    const data = await constantSchema.find({}).exec()
    return data.reduce((p: any,c: any) => {
        if(p[c.groupName]){
            p[c.groupName].push(c)
        } else {
            p[c.groupName] = [c]
        }
        return p
    } ,{})
}