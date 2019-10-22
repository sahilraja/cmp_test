import { PillarSchema } from "./model";

export async function create(userId: string, payload: any) {
    return await PillarSchema.create({ ...payload, createdBy: userId })
}

export async function list() {
    return await PillarSchema.find({}).exec()
}

export async function pillarDetail(id: string) {
    return await PillarSchema.findById(id).exec()
}

export async function updatePillar(id: string, updates: any) {
    return await PillarSchema.findByIdAndUpdate(id, { $set: updates }, { new: true }).exec()
}