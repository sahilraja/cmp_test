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
    const data:any = await constantSchema.find({}).exec();
    console.log(data);
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