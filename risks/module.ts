import { RiskSchema } from "./model";
import { checkRoleScope } from "../utils/role_management";
import { APIError } from "../utils/custom-error";
import { RISK } from "../utils/error_msg";
import { userFindOne } from "../utils/users";
import { dateDifference } from "../utils/utils";

export async function create(payload: any, projectId: string, userObj: any) {
    const isEligible = await checkRoleScope(userObj.role, `manage-risk`)
    if (!isEligible) {
        throw new APIError(RISK.UNAUTHORIZED_ACCESS)
    }
    let risk = await RiskSchema.create({ ...payload, projectId, createdBy: userObj._id });
    await RiskSchema.create({ ...payload, parentId: risk._id, projectId, createdBy: userObj._id })
    return risk
}

export async function list(projectId: string) {
    let details = await RiskSchema.find({ deleted: false, projectId, parentId: null }).populate({ path: 'phase' }).sort({ createdAt: 1 }).exec()
    return details.map((riskObj: any) => { return { ...riskObj, age: dateDifference(riskObj.createdAt) } })
}

export async function detail(riskId: string) {
    const detail: any = await RiskSchema.findById(riskId).populate({ path: 'phase' }).exec()
    const { riskOwner } = detail.toJSON()
    if (riskOwner) {
        return { ...detail.toJSON(), riskOwner: await userFindOne('_id', riskOwner), age: dateDifference(detail.createdAt) }
    }
    return detail
}

export async function edit(id: string, updates: any, userObj: any) {
    const isEligible = await checkRoleScope(userObj.role, `manage-risk`)
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
        await Promise.all(updateObjs.map((riskObj) => saveaAll(riskObj, projectId, userObj)))
        return { message: "successfully save all risks" }
    } catch (err) {
        throw err
    };
};

async function saveaAll(riskObj: any, projectId: string, userObj: any) {
    try {
        if ("_id" in riskObj || "id" in riskObj) {
            const oldObject: any = await RiskSchema.findById(riskObj._id || riskObj.id).exec();
            if (Object.keys(riskObj).some(key => riskObj[key] != oldObject[key])) {
                if (Object.keys(riskObj).includes('impact'))
                    if (oldObject.impact != riskObj.impact)
                        riskObj['previousTrend'] = oldObject.impact * oldObject.probability;
                if (Object.keys(riskObj).includes('probability'))
                    if (oldObject.probability != riskObj.probability)
                        riskObj['previousTrend'] = oldObject.impact * oldObject.probability;
                let riskDetails: any = await RiskSchema.findByIdAndUpdate(riskObj._id || riskObj.id, { $set: riskObj }, { new: true }).exec()
                await RiskSchema.create({ ...riskDetails, parentId: riskDetails._id })
            };
        } else {
            let risk = await RiskSchema.create({ ...riskObj, projectId, createdBy: userObj._id });
            await RiskSchema.create({ ...riskObj, parentId: risk._id, projectId, createdBy: userObj._id })
        }
        return true
    } catch (err) {
        throw err
    };
};

export async function logList(projectId: string, riskId: string) {
    return await RiskSchema.find({ deleted: false, projectId, parentId: riskId }).populate({ path: 'phase' }).sort({ createdAt: 1 }).exec()
}

