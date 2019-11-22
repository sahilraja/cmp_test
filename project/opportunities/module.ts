import { OpportunitySchema } from "./model";
import { APIError } from "../../utils/custom-error";
import { checkRoleScope } from "../../role/module";
import { OPPORTUNITY } from "../../utils/error_msg";
import { userFindOne } from "../../utils/users";

export async function create(payload: any, projectId: string, userObj: any) {
    const isEligible = await checkRoleScope(userObj.role, `manage-opportunity`)
    if(!isEligible){
        throw new APIError(OPPORTUNITY.UNAUTHORIZED_ACCESS)
    }
    return await OpportunitySchema.create({...payload, projectId, createdBy: userObj._id})
}

export async function list(projectId: string) {
    return await OpportunitySchema.find({ deleted: false, projectId }).populate({ path: 'phase'}).sort({ createdAt: 1 }).exec()
}

export async function detail(id: string) {
    const detail: any = await OpportunitySchema.findById(id).populate({path:'phase'}).exec()
    const {opportunityOwner} = detail.toJSON()  
    if(opportunityOwner){
        return {...detail.toJSON(), opportunityOwner: await userFindOne('_id', opportunityOwner)}
    }
    return detail
}

export async function edit(id: string, updates: any, userObj: any) {
    const isEligible = await checkRoleScope(userObj.role, `manage-opportunity`)
    if(!isEligible){
        throw new APIError(OPPORTUNITY.UNAUTHORIZED_ACCESS)
    }
    const oldObject: any = await OpportunitySchema.findById(id).exec()
    if (Object.keys(updates).includes('impact')) {
        if (oldObject.impact != updates.impact) {
            updates['previousTrend'] = oldObject.impact * oldObject.probability
        }
    }
    if (Object.keys(updates).includes('probability')) {
        if (oldObject.probability != updates.probability) {
            updates['previousTrend'] = oldObject.impact * oldObject.probability
        }
    }
    return await OpportunitySchema.findByIdAndUpdate(id, { $set: updates }).exec()
}

