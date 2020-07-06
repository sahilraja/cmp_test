import { RiskSchema } from "./model";
import { checkRoleScope } from "../utils/role_management";
import { APIError } from "../utils/custom-error";
import { RISK, ACTIVITY_LOG } from "../utils/error_msg";
import { userFindOne } from "../utils/users";
import { dateDifference } from "../utils/utils";
import { formateRoles, roleFormanting, userFindManyWithRole } from "../users/module";
import { create as createLog } from "../log/module";
export async function create(payload: any, projectId: string, userObj: any) {
    const isEligible = await checkRoleScope(userObj.role, `manage-risk-opportunity`)
    if (!isEligible) {
        throw new APIError(RISK.UNAUTHORIZED_ACCESS)
    }
    let risk = await RiskSchema.create({ ...payload, projectId, createdBy: userObj._id });
    await RiskSchema.create({ ...payload, parentId: risk._id, projectId, createdBy: userObj._id })
    return risk
}

export async function list(projectId: string) {
    let details = await RiskSchema.find({ deleted: false, projectId, parentId: null }).populate({ path: 'phase' }).sort({ createdAt: 1 }).exec()
    return details.map((riskObj: any) => { return { ...riskObj.toJSON(), age: dateDifference(riskObj.createdAt) } })
}

export async function detail(riskId: string) {
    const detail: any = await RiskSchema.findById(riskId).populate({ path: 'phase' }).exec()
    const { riskOwner } = detail.toJSON()
    if (riskOwner) {
        return { ...detail.toJSON(), riskOwner: (await userFindManyWithRole(riskOwner) || [{}]).pop(), age: dateDifference(detail.createdAt) }
    }
    return detail
}

export async function edit(id: string, updates: any, userObj: any) {
    const isEligible = await checkRoleScope(userObj.role, `manage-risk-opportunity`)
    if (!isEligible) {
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
    let riskDetails: any = await RiskSchema.findByIdAndUpdate(id, { $set: updates }, { new: true }).exec()
    await RiskSchema.create({ ...riskDetails, parentId: riskDetails._id })
    return riskDetails
}

export async function riskSaveAll(projectId: string, updateObjs: any[], userObj: any): Promise<{ message: string }> {
    try {
        const isEligible = await checkRoleScope(userObj.role, `manage-risk-opportunity`)
        if (!isEligible) {
            throw new APIError(RISK.UNAUTHORIZED_ACCESS)
        }
        let response = await Promise.all(updateObjs.map((riskObj) => saveaAll(riskObj, projectId, userObj)))
        return response[0]
    } catch (err) {
        throw err
    };
};

async function saveaAll(riskObj: any, projectId: string, userObj: any) {
    try {
        let message = `Saved successfully`
        if ("_id" in riskObj || "id" in riskObj) {
            const {riskCriticality, phase, riskPrevTrend, showDeleteIcon, showHistoryIcon, dateRaised, ...others} = riskObj
            const oldObject: any = await RiskSchema.findById(riskObj._id || riskObj.id).exec();
            if (Object.keys(others).some(key => others[key] != oldObject[key]) || 
            phase.some((_phase: string) => !(oldObject.phase || []).map((p: any) => p.toString()).includes(_phase))) {
                if (!riskObj.riskTrend && riskObj.riskTrend != 0) {
                    riskObj.riskTrend = 0
                } else {
                    let lastUpdatedObj: any = (await RiskSchema.find({ parentId: riskObj._id || riskObj.id })).pop()
                    // riskObj.riskTrend = (riskObj.impact || 0) * (riskObj.probability || 0) - (lastUpdatedObj.impact || 0) * (lastUpdatedObj.probability || 0)
                    riskObj.riskTrend = (((riskObj.impact || 0) != (lastUpdatedObj.impact || 0)) || ((riskObj.probability || 0) != (lastUpdatedObj.probability || 0))) ? 
                    ((riskObj.impact || 0) * (riskObj.probability || 0) - (lastUpdatedObj.impact || 0) * (lastUpdatedObj.probability || 0)) : riskObj.riskTrend
                }
                if (Object.keys(riskObj).includes('impact'))
                    if (oldObject.impact != riskObj.impact)
                        riskObj['previousTrend'] = oldObject.impact * oldObject.probability;
                if (Object.keys(riskObj).includes('probability'))
                    if (oldObject.probability != riskObj.probability)
                        riskObj['previousTrend'] = oldObject.impact * oldObject.probability;
                let riskDetails: any = await RiskSchema.findByIdAndUpdate(riskObj._id || riskObj.id, { $set: riskObj }, { new: true }).exec()
                createLog({projectId, riskOpportunityNumber:riskDetails.riskNumber, activityBy: userObj._id, activityType:ACTIVITY_LOG.RISK_UPDATED, opportunityId: riskDetails._id})
                const {createdAt, updatedAt, ...others} = riskDetails.toJSON()
                await RiskSchema.create({ ...others, projectId, parentId: riskDetails._id, updatedAt: new Date() })
            };
            message = `Risk(s) updated successfully`
        } else {
            let risk: any = await RiskSchema.create({ ...riskObj, projectId, createdBy: userObj._id });
            createLog({projectId, riskOpportunityNumber:risk.riskNumber, activityBy: userObj._id, activityType:ACTIVITY_LOG.RISK_CREATED, riskId: risk._id})
            await RiskSchema.create({ ...riskObj, parentId: risk._id, projectId, createdBy: userObj._id })
            message = `Risk(s) added successfully`
        }
        return {message}
    } catch (err) {
        throw err
    };
};

export async function logList(projectId: string, riskId: string) {
    let list = await RiskSchema.find({ deleted: false, projectId, parentId: riskId }).populate({ path: 'phase' }).sort({ createdAt: 1 }).exec()
    return list
}

