import { OpportunitySchema } from "./model";
import { APIError } from "../../utils/custom-error";
import { OPPORTUNITY } from "../../utils/error_msg";
import { userFindOne } from "../../utils/users";
import { checkRoleScope } from "../../utils/role_management";

export async function create(payload: any, projectId: string, userObj: any) {
    const isEligible = await checkRoleScope(userObj.role, `manage-opportunity`)
    if(!isEligible){
        throw new APIError(OPPORTUNITY.UNAUTHORIZED_ACCESS)
    }
    return await OpportunitySchema.create({...payload, projectId, createdBy: userObj._id})
}

export async function list(projectId: string) {
    return await OpportunitySchema.find({ deleted: false, projectId, parentId: null }).populate({ path: 'phase'}).sort({ createdAt: 1 }).exec()
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

export async function opportunitySaveAll(projectId: string, updateObjs: any[], userObj: any): Promise<{ message: string }> {
    try {
        await Promise.all(updateObjs.map((opportunityObj) => saveaAllOpportunities(opportunityObj, projectId, userObj)))
        return { message: "successfully save all opportunities" }
    } catch (err) {
        throw err
    };
};

async function saveaAllOpportunities(opportunityObj: any, projectId: string, userObj: any) {
    try {
        if ("_id" in opportunityObj || "id" in opportunityObj) {
            const oldObject: any = await OpportunitySchema.findById(opportunityObj._id || opportunityObj.id).exec();
            if (Object.keys(opportunityObj).some(key => opportunityObj[key] != oldObject[key])) {
                if (Object.keys(opportunityObj).includes('impact'))
                    if (oldObject.impact != opportunityObj.impact)
                        opportunityObj['previousTrend'] = oldObject.impact * oldObject.probability;
                if (Object.keys(opportunityObj).includes('probability'))
                    if (oldObject.probability != opportunityObj.probability)
                        opportunityObj['previousTrend'] = oldObject.impact * oldObject.probability;
                let opportunityDetails: any = await OpportunitySchema.findByIdAndUpdate(opportunityObj._id || opportunityObj.id, { $set: opportunityObj }, { new: true }).exec()
                await OpportunitySchema.create({ ...opportunityDetails, parentId: opportunityDetails._id })
            };
        } else {
            let opportunity = await OpportunitySchema.create({ ...opportunityObj, projectId, createdBy: userObj._id });
            await OpportunitySchema.create({ ...opportunityObj, parentId: opportunity._id, projectId, createdBy: userObj._id })
        }
        return true
    } catch (err) {
        throw err
    };
};

export async function logList(projectId: string, opportunityId: string) {
    return await OpportunitySchema.find({ deleted: false, projectId, parentId: opportunityId }).populate({ path: 'phase' }).sort({ createdAt: 1 }).exec()
}
