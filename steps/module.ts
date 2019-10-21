import { StepsSchema } from "./model";

export async function create(userId: string, payload: any) {
    return await StepsSchema.create({...payload, createdBy:userId})
}

export async function list() {
    return await StepsSchema.find({}).exec()
}

export async function stepDetail(id: string) {
    return await StepsSchema.findById(id).exec()
}

export async function updateStep(id: string, updates: any) {
    return await StepsSchema.findByIdAndUpdate(id, {$set:updates}, {new: true}).exec()
}