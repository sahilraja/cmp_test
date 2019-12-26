import { phaseSchema } from "./model";
import { APIError } from "../utils/custom-error";
import { userDetails } from "../users/module";
import { USER_ROUTER } from "../utils/error_msg";
import { checkRoleScope } from "../utils/role_management";


export async function createPhase(payload: any, userObj: any) {
    try {
        let isEligible = await checkRoleScope(userObj.role, "phase-manage");
        if (!isEligible) throw new APIError("Unauthorized Action.", 403);
        if (!payload.phaseName && !payload.colorCode) {
            throw new APIError(USER_ROUTER.MANDATORY)
        }
        if (payload.phaseName && (/[ ]{2,}/.test(payload.phaseName) || !/[A-Za-z0-9  -]+$/.test(payload.phaseName))) throw new Error("you have entered invalid name. please try again.")
        let phaseInfo: any = await phaseSchema.create({ ...payload, phaseName: payload.phaseName.toLowerCase(), createdBy: userObj._id });
        let { disable, ...phaseResult } = phaseInfo.toObject();
        return phaseResult
    }
    catch (err) {
        throw err
    }
}

export async function editPhase(phaseId: string, body: any, userObj: any) {
    try {
        let isEligible = await checkRoleScope(userObj.role, "phase-manage");
        if (!isEligible) throw new APIError("Unauthorized Action.", 403);
        if (body.phaseName && (/[ ]{2,}/.test(body.phaseName) || !/[A-Za-z0-9  -]+$/.test(body.phaseName))) throw new Error("you have entered invalid name. please try again.")
        let phaseInfo: any = await phaseSchema.findByIdAndUpdate(phaseId, { $set: { phaseName: body.phaseName.toLowerCase(), colorCode: body.colorCode } }, { new: true }).exec()
        let { disable, ...phaseResult } = phaseInfo.toObject();
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