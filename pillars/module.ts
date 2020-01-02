import { PillarSchema } from "./model";
import { httpRequest, checkRoleScope } from "../utils/role_management";
import { TASKS_URL } from "../utils/urls";
import { APIError } from "../utils/custom-error";
import { PROJECT_ROUTER } from "../utils/error_msg";

export async function create(userId: string, payload: any, userRole: any) {
    const isEligible = await checkRoleScope(userRole, `add-edit-pillar`)
    if (!isEligible) {
        throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
    }
    return await PillarSchema.create({ ...payload, nameCode: payload.name, createdBy: userId })
}

export async function list(userToken: string) {
    const tasks = await httpRequest({
        url: `${TASKS_URL}/task/getPillarRelatedTasks`,
        json: true,
        method: 'POST',
        body: { status: { $nin: [8] } },
        headers: { 'Authorization': `Bearer ${userToken}` }
    })
    const pillars = await PillarSchema.find({ disabled: false }).exec()
    return pillars.map((pillar: any) => {
        const filteredTasks = (tasks as any).filter((task: any) => task.pillarId == pillar.id)
        return ({
            ...pillar.toJSON(),
            progressPercentage: filteredTasks.length ? (filteredTasks.reduce((p: number, c: any) => p + (c.progressPercentage || 0), 0) / filteredTasks.length).toFixed(0) : 0
        })
    })
}

export async function pillarDetail(id: string) {
    return await PillarSchema.findById(id).exec()
}

export async function updatePillar(id: string, updates: any, userRole: any) {
    const isEligible = await checkRoleScope(userRole, `add-edit-pillar`)
    if (!isEligible) {
        throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
    }
    if (updates.name) {
        updates = { ...updates, nameCode: updates.name }
    }
    return await PillarSchema.findByIdAndUpdate(id, { $set: updates }, { new: true }).exec()
}

export async function getPillars() {
    return await PillarSchema.find({ disabled: false }).exec()
}

export async function getPillarsbyIds(pillarIds: string[]) {
    return await PillarSchema.find({ _id: { $in: pillarIds } }).exec()
}