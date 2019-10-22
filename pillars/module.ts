import { PillarSchema } from "./model";
import { httpRequest } from "../utils/role_management";
import { TASKS_URL } from "../utils/urls";

export async function create(userId: string, payload: any) {
    return await PillarSchema.create({ ...payload, createdBy: userId })
}

export async function list(userToken: string) {
    const tasks = await httpRequest({
        url:`${TASKS_URL}/getPillarRelatedTasks`,
        json: true,
        body: { status: { $nin: [8] } },
        headers:{'Authorization': `Bearer ${userToken}`}
    })
    const pillars = await PillarSchema.find({ disabled: false }).exec()
    return pillars.map((pillar: any) => 
    ({...pillar.toJSON(), 
        progressPercentage: (tasks as any).filter((task: any) => task.pillarId == pillar.id).reduce((p:number,c:any) => p + (c.progressPercentage || 0) )
    }))
}

export async function pillarDetail(id: string) {
    return await PillarSchema.findById(id).exec()
}

export async function updatePillar(id: string, updates: any) {
    return await PillarSchema.findByIdAndUpdate(id, { $set: updates }, { new: true }).exec()
}

export async function getPillars() {
    return await PillarSchema.find({ disabled: false }).exec()
}