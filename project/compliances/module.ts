import { ComplianceSchema } from "./compliance-model";

export async function createCompliance(payload: object, userObj: any) {
    return await ComplianceSchema.create({...payload, createdBy: userObj._id})
}

export async function listCompliances() {
    return await ComplianceSchema.find({}).exec()
}

export async function editCompliance(id: string, updates: object) {
    return await ComplianceSchema.findByIdAndUpdate(id, { $set: updates }, { new: true }).exec()
}