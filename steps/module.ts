import { StepsSchema } from "./model";

async function stepCount() {
    return await StepsSchema.count({}).exec()
}

export async function create(userId: string, payload: any) {
    return await StepsSchema.create({ ...payload, s_no: (await stepCount()) + 1, createdBy: userId })
}

export async function list() {
    return await StepsSchema.find({}).exec()
}

export async function stepDetail(id: string) {
    return await StepsSchema.findById(id).exec()
}

export async function updateStep(id: string, updates: any) {
    return await StepsSchema.findByIdAndUpdate(id, { $set: updates }, { new: true }).exec()
}

export async function getStepsByIds(ids: string[]) {
    return await StepsSchema.find({ _id: { $in: ids } }).exec()
}