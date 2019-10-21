import { PillarSchema } from "./model";

export async function create(userId: string, payload: any) {
    return await PillarSchema.create({ ...payload, createdBy: userId })
}

export async function list() {
    return await PillarSchema.find({}).exec()
}

export async function stepDetail(id: string) {
    return await PillarSchema.findById(id).exec()
}

export async function updateStep(id: string, updates: any) {
    return await PillarSchema.findByIdAndUpdate(id, { $set: updates }, { new: true }).exec()
}