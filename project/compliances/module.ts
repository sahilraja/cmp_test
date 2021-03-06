import { ComplianceSchema } from "./compliance-model";
import { checkRoleScope, httpRequest } from "../../utils/role_management";
import { APIError } from "../../utils/custom-error";
import { COMPLIANCES } from "../../utils/error_msg";
import { TASKS_URL } from "../../utils/urls";
import { project } from "../project_model";

export async function createCompliance(payload: any, projectId: string, userObj: any) {
    const isEligible = await checkRoleScope(userObj.role, 'manage-compliance')
    if (!isEligible) {
        throw new APIError(COMPLIANCES.UNAUTHORIZED_TO_CREATE)
    }
    if (!payload.taskId) {
        throw new APIError(COMPLIANCES.REQUIRED_TASK)
    }
    return await ComplianceSchema.create({ ...payload, projectId, createdBy: userObj._id })
}

export async function listCompliances(userToken: string, projectId: string) {

    
    const compliances = await ComplianceSchema.find({ projectId }).exec()
    const projectDetails = await project.findById(projectId).select({ miscomplianceSpv: 1, miscomplianceProject: 1 })
    const taskIds = compliances.map((compliance: any) => compliance.taskId).filter(v => !!v)
    const tasks: any = await httpRequest({
        url: `${TASKS_URL}/task/getTasksDocs`,
        method: 'POST',
        body: { taskIds },
        headers: { 'Authorization': `Bearer ${userToken}` },
        json: true
    })
    const filteredTasks = tasks.filter((task: any) => task.status != 8)
    let complianceData = compliances.map((compliance: any) => {
        return {
            ...compliance.toJSON(),
            task: filteredTasks.find((task: any) => task._id == compliance.taskId),
            taskStatus: tasks.find((task: any) => task._id == compliance.taskId).status
        }
    }).filter(compliance => compliance.task)
    let spvCompliance = complianceData.filter(({ complianceType }) => complianceType == "SPV")
    let projectCompliance = complianceData.filter(({ complianceType }) => complianceType == "PROJECT")
    return {
        spvPercentage: spvCompliance ? Math.floor(((spvCompliance.filter(({ taskStatus }) => taskStatus == 4 || taskStatus == 5)).length / spvCompliance.length) * 100) : 0,
        projectPercentage: projectCompliance ? Math.floor(((projectCompliance.filter(({ taskStatus }) => taskStatus == 4 || taskStatus == 5)).length / projectCompliance.length) * 100) : 0,
        spvCompliance, projectCompliance,
        miscompliance: projectDetails
    }
}


export async function editCompliance(id: string, updates: any, userObj: any) {
    const isEligible = await checkRoleScope(userObj.role, 'manage-compliance')
    if (!isEligible) {
        throw new APIError(COMPLIANCES.UNAUTHORIZED_TO_EDIT)
    }
    if (Object.keys(updates).includes('taskId') && !updates.taskId) {
        throw new APIError(COMPLIANCES.REQUIRED_TASK)
    }
    // Need to handle task case
    return await ComplianceSchema.findByIdAndUpdate(id, { $set: updates }, { new: true }).exec()
}