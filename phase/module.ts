import { phaseSchema } from "./model";
import { APIError } from "../utils/custom-error";
import { userDetails } from "../users/module";
import { USER_ROUTER, UNAUTHORIZED_ACTION } from "../utils/error_msg";
import { checkRoleScope,httpRequest } from "../utils/role_management";
import { editProjectPhaseInES } from "../project/module";
import { TASKS_URL } from "../utils/urls";

export async function createPhase(payload: any, userObj: any) {
    try {
        let isEligible = await checkRoleScope(userObj.role, "phase-manage");
        if (!isEligible) throw new APIError(UNAUTHORIZED_ACTION, 403);
        if (!payload.phaseName && !payload.colorCode) {
            throw new APIError(USER_ROUTER.MANDATORY)
        }
        if (!/.*[A-Za-z0-9]{1}.*$/.test(payload.phaseName)) throw new Error(USER_ROUTER.NAME_ERROR)
        let phaseInfo: any = await phaseSchema.create({ ...payload, phaseCode: payload.phaseName.toLowerCase(), createdBy: userObj._id });
        let { disable, ...phaseResult } = phaseInfo.toObject();
        return phaseResult
    }
    catch (err) {
        throw err
    }
}

export async function editPhase(phaseId: string, body: any, userObj: any, token: string) {
    try {
        let isEligible = await checkRoleScope(userObj.role, "phase-manage");
        // if (!isEligible) throw new APIError(UNAUTHORIZED_ACTION, 403);
        if (!/.*[A-Za-z0-9]{1}.*$/.test(body.phaseName)) throw new Error(USER_ROUTER.NAME_ERROR)
        let phaseInfo: any = await phaseSchema.findByIdAndUpdate(phaseId, { $set: { phaseName: body.phaseName, phaseCode: body.phaseName.toLowerCase(), colorCode: body.colorCode } }, { new: true }).exec()
        let { disable, ...phaseResult } = phaseInfo.toObject();
        editProjectPhaseInES(phaseResult.id || phaseResult._id, token)
        updatePhaseInES(token)
        return phaseResult
    }
    catch (err) {
        throw err
    }
}

export async function getPhase(phaseId: string) {
    try {
        let phaseInfo: any = await phaseSchema.findById(phaseId).exec();
        let { disable, ...phaseResult } = phaseInfo.toObject();
        return phaseResult
    }
    catch (err) {
        throw err
    }
}

export async function deletePhase(phaseId: string) {
    try {
        await phaseSchema.findByIdAndUpdate(phaseId, { disable: true }).exec();
        return { messsage: "successfully deleted phase" }
    }
    catch (err) {
        throw err
    }
}
export async function listPhase() {
    try {
        return await phaseSchema.find({}).exec();
    }
    catch (err) {
        throw err
    }
}
export async function userListPhase(userId: string) {
    try {
        return await phaseSchema.findById({ createdBy: userId }).exec();
    }
    catch (err) {
        throw err
    }
}

export async function updatePhaseInES(userToken: string) {
    return await httpRequest({
        url: `${TASKS_URL}/task/getTasksByProjectIds`,
        json: true,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${userToken}` }
      })
  }