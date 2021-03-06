import { OpportunitySchema } from "./model";
import { APIError } from "../../utils/custom-error";
import { OPPORTUNITY, ACTIVITY_LOG } from "../../utils/error_msg";
import { userFindOne } from "../../utils/users";
import { checkRoleScope } from "../../utils/role_management";
import { dateDifference } from "../../utils/utils";
import { roleFormanting, userFindManyWithRole } from "../../users/module";
import { create as createLog } from "../../log/module";

export async function create(payload: any, projectId: string, userObj: any) {
    const isEligible = await checkRoleScope(userObj.role, `manage-risk-opportunity`)
    if (!isEligible) {
        throw new APIError(OPPORTUNITY.UNAUTHORIZED_ACCESS)
    }
    return await OpportunitySchema.create({ ...payload, projectId, createdBy: userObj._id })
}

export async function list(projectId: string) {
    let details = await OpportunitySchema.find({ deleted: false, projectId, parentId: null }).populate({ path: 'phase' }).sort({ createdAt: 1 }).exec()
    return details.map((obj: any) => { return { ...obj.toJSON(), age: dateDifference(obj.createdAt) } })
}

export async function detail(id: string) {
    const detail: any = await OpportunitySchema.findById(id).populate({ path: 'phase' }).exec()
    const { opportunityOwner } = detail.toJSON()
    if (opportunityOwner) {
        return { ...detail.toJSON(), opportunityOwner: (await userFindManyWithRole(opportunityOwner) || [{}]).pop(), age: dateDifference(detail.createdAt) }
    }
    return detail
}

export async function edit(id: string, updates: any, userObj: any) {
    const isEligible = await checkRoleScope(userObj.role, `manage-risk-opportunity`)
    if (!isEligible) {
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
        const isEligible = await checkRoleScope(userObj.role, `manage-risk-opportunity`)
        if (!isEligible) throw new APIError(OPPORTUNITY.UNAUTHORIZED_ACCESS)
        await Promise.all(updateObjs.map((opportunityObj) => saveaAllOpportunities(opportunityObj, projectId, userObj)))
        return { message: "Saved successfully" }
    } catch (err) {
        throw err
    };
};

async function saveaAllOpportunities(opportunityObj: any, projectId: string, userObj: any) {
    try {
        if ("_id" in opportunityObj || "id" in opportunityObj) {
            const {opportunityCriticality, phase, opportunityPrevTrend, showDeleteIcon, showHistoryIcon, dateRaised, ...others} = opportunityObj
            const oldObject: any = await OpportunitySchema.findById(opportunityObj._id || opportunityObj.id).exec();
            if (Object.keys(others).some(key => others[key] != oldObject[key]) || 
            phase.some((_phase: string) => !(oldObject.phase || []).map((p: any) => p.toString()).includes(_phase))) {
                if (!opportunityObj.opportunityTrend && opportunityObj.opportunityTrend != 0) {
                    opportunityObj.opportunityTrend = 0
                } else {
                    let lastUpdatedObj: any = (await OpportunitySchema.find({ parentId: opportunityObj._id || opportunityObj.id })).pop()
                    opportunityObj.opportunityTrend = (((opportunityObj.impact || 0) != (lastUpdatedObj.impact || 0)) || ((opportunityObj.probability || 0) != (lastUpdatedObj.probability || 0))) ? 
                    ((opportunityObj.impact || 0) * (opportunityObj.probability || 0) - (lastUpdatedObj.impact || 0) * (lastUpdatedObj.probability || 0)) : opportunityObj.opportunityTrend
                }
                if (Object.keys(opportunityObj).includes('impact'))
                    if (oldObject.impact != opportunityObj.impact)
                        opportunityObj['previousTrend'] = oldObject.impact * oldObject.probability;
                if (Object.keys(opportunityObj).includes('probability'))
                    if (oldObject.probability != opportunityObj.probability)
                        opportunityObj['previousTrend'] = oldObject.impact * oldObject.probability;
                let opportunityDetails: any = await OpportunitySchema.findByIdAndUpdate(opportunityObj._id || opportunityObj.id, { $set: opportunityObj }, { new: true }).exec()
                createLog({projectId, riskOpportunityNumber:opportunityDetails.opportunityNumber, activityBy: userObj._id, activityType:ACTIVITY_LOG.OPPORTUNITY_UPDATED, opportunityId: opportunityDetails._id})
                const {createdAt, updatedAt, ...others} = opportunityDetails.toJSON()
                await OpportunitySchema.create({ ...others, projectId, parentId: opportunityDetails._id, createdAt: new Date(), updatedAt: new Date() })
            };
        } else {
            let opportunity: any = await OpportunitySchema.create({ ...opportunityObj, projectId, createdBy: userObj._id });
            createLog({projectId, riskOpportunityNumber:opportunity.opportunityNumber, activityBy: userObj._id, activityType:ACTIVITY_LOG.OPPORTUNITY_CREATED, opportunityId: opportunity._id})
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
