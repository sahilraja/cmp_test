import { StepsSchema } from "./model";
import { checkRoleScope } from "../utils/role_management";
import { APIError } from "../utils/custom-error";
import { PROJECT_ROUTER } from "../utils/error_msg";

async function stepCount() {
    return await StepsSchema.count({}).exec()
}

export async function create(userId: string, payload: any, userRole: any) {
    const isEligible = await checkRoleScope(userRole, `add-edit-step`)
    if(!isEligible){
        throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
    }
    const stepInfo= await StepsSchema.create({ ...payload, nameCode: payload.name, s_no: (await stepCount()) + 1, createdBy: userId })
    return {stepInfo,successMessage:`Step created successfully`}
}

export async function list() {
    return await StepsSchema.find({}).exec()
}

export async function stepDetail(id: string) {
    return await StepsSchema.findById(id).exec()
}

export async function updateStep(id: string, updates: any, userRole: any) {
    const isEligible = await checkRoleScope(userRole, `add-edit-step`)
    if(!isEligible){
        throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
    }
    if(updates.name){
        updates = {...updates, nameCode: updates.name }
    }
    const stepInfo= await StepsSchema.findByIdAndUpdate(id, { $set: updates }, { new: true }).exec()
    return {stepInfo,successMessage:`Step updated successfully`}
}

export async function getStepsByIds(ids: string[]) {
    return await StepsSchema.find({ _id: { $in: ids } }).exec()
}