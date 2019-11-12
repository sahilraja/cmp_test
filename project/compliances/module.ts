import { ComplianceSchema } from "./compliance-model";
import { checkRoleScope } from "../../utils/role_management";
import { APIError } from "../../utils/custom-error";
import { COMPLIANCES } from "../../utils/error_msg";

export async function createCompliance(payload: object, userObj: any) {
    const isEligible = await checkRoleScope(userObj.role, 'create-compliance')
    if(!isEligible){
        throw new APIError(COMPLIANCES.UNAUTHORIZED_TO_CREATE)
    }
    return await ComplianceSchema.create({...payload, createdBy: userObj._id})
}

export async function listCompliances() {
    return await ComplianceSchema.find({}).exec()
}

export async function editCompliance(id: string, updates: object, userObj: any) {
    const isEligible = await checkRoleScope(userObj.role, 'edit-compliance')
    if(!isEligible){
        throw new APIError(COMPLIANCES.UNAUTHORIZED_TO_EDIT)
    }
    // Need to handle task case
    return await ComplianceSchema.findByIdAndUpdate(id, { $set: updates }, { new: true }).exec()
}