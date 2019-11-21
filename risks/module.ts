import { RiskSchema } from "./model";
import { checkRoleScope } from "../utils/role_management";
import { APIError } from "../utils/custom-error";
import { RISK } from "../utils/error_msg";

export async function create(payload: any, projectId: string, userObj: any) {
    const isEligible = await checkRoleScope(userObj.role, `manage-risk`)
    if(!isEligible){
        throw new APIError(RISK.UNAUTHORIZED_ACCESS)
    }
    return await RiskSchema.create({...payload, projectId, createdBy: userObj._id})
}

export async function list(projectId: string) {
    return await RiskSchema.find({ deleted: false, projectId }).populate({ path: 'phase', select: 'phaseName' }).sort({ createdAt: 1 }).exec()
}

export async function detail(riskId: string) {
    return RiskSchema.findById(riskId).populate({ path: 'phase', select: 'phaseName' }).exec()
}

export async function edit(id: string, updates: any, userObj: any) {
    const isEligible = await checkRoleScope(userObj.role, `manage-risk`)
    if(!isEligible){
        throw new APIError(RISK.UNAUTHORIZED_ACCESS)
    }
    const oldObject: any = await RiskSchema.findById(id).exec()
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
    return await RiskSchema.findByIdAndUpdate(id, { $set: updates }).exec()
}

