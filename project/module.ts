import { MISSING, PROJECT_ROUTER, ACTIVITY_LOG, TASK_ERROR } from "../utils/error_msg";
import { project as ProjectSchema } from "./project_model";
import { Types } from "mongoose";
import { tags } from "../tags/tag_model";
import { themes } from "./theme_model";
import { userRoleAndScope, roles_list, role_list } from "../role/module";
import { taskModel } from "./task_model";
import { workflowModel } from "./workflow_model";
import { checkCapability } from "../utils/rbac";
import { httpRequest, checkRoleScope } from "../utils/role_management";
import { TASKS_URL } from "../utils/urls";
import { getUserDetail } from "../users/module";
import { userFindMany } from "../utils/users";
import { APIError } from "../utils/custom-error";
import { create as createLog } from "../log/module";
import { documentsList } from "../documents/module";
import { unlinkSync } from "fs";
import { extname } from "path";
import * as xlsx from "xlsx";

//  Add city Code
export async function createProject(reqObject: any, user: any) {
  try {
    if (!reqObject.reference || !reqObject.name) {
      throw new Error(MISSING);
    }
    let isEligible = await checkRoleScope(user.role, "create-project");
    if (!isEligible) throw new APIError("Unauthorized Action.", 403);
    //  check capability
    // let capability = await checkCapability({
    //   role: user.role,
    //   scope: "global",
    //   capability: "create-project"
    // });
    // if (!capability.status) throw new Error("Invalid User");

    const createdProject = await ProjectSchema.create({
      createdBy: user._id,
      name: reqObject.name,
      reference: reqObject.reference,
      city: reqObject.cityname,
      summary: reqObject.description || "N/A",
      maturationStartDate: { date: reqObject.maturationStartDate, modifiedBy: user._id },
      maturationEndDate: { date: reqObject.maturationEndDate, modifiedBy: user._id },
      fundsReleased: [{ installment: 1 }, { installment: 2 }, { installment: 3 }, { installment: 4 }],
      fundsUtilised: [{ installment: 1 }, { installment: 2 }, { installment: 3 }, { installment: 4 }],
      phase: reqObject.phase
    });
    createLog({ activityType: ACTIVITY_LOG.PROJECT_CREATED, projectId: createdProject.id, activityBy: user._id })
    return createdProject
  } catch (err) {
    console.error(err);
    throw err;
  }
}

//  Edit city Code
export async function editProject(id: any, reqObject: any, user: any) {
  try {
    if (!id || !user) throw new Error(MISSING);
    let obj: any = {};

    let isEligible = await checkRoleScope(user.role, "edit-project");
    if (!isEligible) throw new APIError("Unauthorized Action.", 403);
    //  check capability
    // let capability = await checkCapability({
    //   role: user.role,
    //   scope: "global",
    //   capability: "create-project"
    // });
    // if (!capability.status) throw new Error("Invalid User");

    if (reqObject.reference) {
      obj.reference = reqObject.reference;
    }
    if (reqObject.name) {
      obj.name = reqObject.name;
    }
    if (reqObject.cityname) {
      obj.city = reqObject.cityname;
    }
    if (reqObject.description) {
      obj.summary = reqObject.description;
    }
    if (reqObject.maturationStartDate) {
      obj.maturationStartDate = { date: reqObject.maturationStartDate, modifiedBy: user._id }
    }
    if (reqObject.phase) {
      obj.phase = reqObject.phase
    }
    const updatedProject = await ProjectSchema.findByIdAndUpdate(id, { $set: obj }, { new: true }).exec();
    return updatedProject
  } catch (err) {
    console.error(err);
    throw err;
  }
}


export async function manageProjectMembers(id: string, members: string[], userId: string) {
  members = Array.from(new Set(members))
  if (members.includes(userId)) {
    throw new APIError(`You are trying to add yourself as project member`)
  }
  const previousProjectData: any = await ProjectSchema.findById(id).exec()
  const updatedProject: any = await ProjectSchema.findByIdAndUpdate(id, { $set: { members } }, { new: true }).exec()
  const removedUserIds = previousProjectData.members.filter((member: string) => !updatedProject.members.includes(member))
  const addedUserIds = updatedProject.members.filter((member: string) => !previousProjectData.members.includes(member))
  createLog({ activityType: ACTIVITY_LOG.PROJECT_MEMBERS_UPDATED, activityBy: userId, projectId: id, addedUserIds, removedUserIds })
  return updatedProject
}

export async function getProjectMembers(id: string) {
  const { members }: any = await ProjectSchema.findById(id).exec()
  const [users, formattedRoleObjs]: any = await Promise.all([
    userFindMany('_id', members, { firstName: 1, lastName: 1, middleName: 1, email: 1 }),
    role_list()
  ])
  const usersRoles = await Promise.all(members.map((user: string) => userRoleAndScope(user)))
  return users.map((user: any, i: number) => ({ ...user, role: formatUserRole((usersRoles.find((role: any) => role.user == user._id) as any).data.global[0], formattedRoleObjs.roles) }))
}

function formatUserRole(role: string, formattedRoleObjs: any) {
  let userRole: any = formattedRoleObjs.find((roleObj: any) => roleObj.role === role);
  return userRole ? userRole.roleName : role;
}

//  Get List of city Codes
export async function projectList() {
  try {
    return await ProjectSchema.find({ is_active: true }).exec();
  } catch (err) {
    console.error(err);
    throw err;
  }
}

//  edit status of city code
export async function city_code_status(id: any, userObj: any) {
  try {
    if (!id) throw new Error(MISSING);
    let isEligible = await checkRoleScope(userObj.role, "edit-project");
    if (!isEligible) throw new APIError("Unauthorized Action.", 403);
    let projectData: any = await ProjectSchema.findById(id).exec();
    if (!projectData) {
      throw new Error("project not there");
    }
    return await ProjectSchema.findByIdAndUpdate(
      { id },
      { is_active: projectData.is_active ? false : true }, { new: true }
    ).exec();
  } catch (err) {
    console.error(err);
    throw err;
  }
}

//  add tag
export async function add_tag(reqObject: any, userObj: any) {
  try {
    if (!reqObject.tag) {
      throw new Error(MISSING);
    }
    let isEligible = await checkRoleScope(userObj.role, "create-tag");
    if (!isEligible) throw new APIError("Unauthorized Action.", 403);
    return await tags.create({
      tag: reqObject.tag,
      description: reqObject.description || "N/A"
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
}

//  edit tag
export async function edit_tag(id: any, reqObject: any, userObj: any) {
  try {
    let isEligible = await checkRoleScope(userObj.role, "edit-tag");
    if (!isEligible) throw new APIError("Unauthorized Action.", 403);
    let obj: any = {};
    if (reqObject.tag) {
      obj.tag = reqObject.tag;
    }
    if (reqObject.description) {
      obj.description = reqObject.description;
    }
    return await tags.findByIdAndUpdate(id, obj, { new: true });
  } catch (err) {
    console.error(err);
    throw err;
  }
}



export async function getTagByIds(ids: string[]) {
  return await tags.find({ _id: { $in: ids } }).exec()
}

//  edit status of tag
export async function tag_status(id: any, userObj: any) {
  try {
    let isEligible = await checkRoleScope(userObj.role, "edit-tag");
    if (!isEligible) throw new APIError("Unauthorized Action.", 403);
    let city: any = await tags.findById(id);
    if (!city) {
      throw new Error(MISSING);
    }
    return await tags.findByIdAndUpdate(
      { id },
      { is_active: city.is_active == true ? false : true }
    );
  } catch (err) {
    console.error(err);
    throw err;
  }
}

//  add theme
export async function add_theme(reqObject: any) {
  try {
    if (!reqObject.theme) {
      throw new Error(MISSING);
    }
    return await themes.create({
      theme: reqObject.theme,
      description: reqObject.description || "N/A"
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
}

//  edit theme
export async function edit_theme(id: any, reqObject: any) {
  try {
    let obj: any = {};
    if (reqObject.theme) {
      obj.theme = reqObject.theme;
    }
    if (reqObject.description) {
      obj.description = reqObject.description;
    }
    return await themes.findByIdAndUpdate(id, obj, { new: true });
  } catch (err) {
    console.error(err);
    throw err;
  }
}

//  get list of theme
export async function theme_list() {
  try {
    return await themes.find({ is_active: true });
  } catch (err) {
    console.error(err);
    throw err;
  }
}

//  edit status of theme
export async function theme_status(id: any) {
  try {
    let city = await themes.findById(id);
    if (!city) {
      throw new Error(MISSING);
    }
    return await themes.findByIdAndUpdate(
      { id },
      { is_active: city.is_active == true ? false : true }
    );
  } catch (err) {
    console.error(err);
    throw err;
  }
}

//get projects list
export async function getProjectsList(userId: any, userToken: string) {
  try {
    // let userProjects: any = await userRoleAndScope(userId);
    // if (!userProjects) throw new Error("user have no projects");
    //const { docs: list, page, pages } = await ProjectSchema.paginate({ $or: [{ createdBy: userId }, { members: { $in: [userId] } }] })
    const { docs: list, page, pages } = await ProjectSchema.paginate({ $or: [{ createdBy: userId }, { members: { $in: [userId] } }] }, { populate: "phase" })
    const projectIds = (list || []).map((_list) => _list.id);
    return { docs: await mapProgressPercentageForProjects(projectIds, userToken, list), page, pages };
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function mapProgressPercentageForProjects(projectIds: string[], userToken: string, list: any[]) {
  const projectRelatedTasks = await httpRequest({
    url: `${TASKS_URL}/task/getTasksByProjectIds`,
    body: { projectIds },
    json: true,
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` }
  })
  return (list || []).map((_list) => {
    const tasksForTheProject = (projectRelatedTasks as any).filter((task: any) => task.projectId == _list.id)
    return ({ ..._list.toJSON(), progressPercentage: tasksForTheProject.length ? (tasksForTheProject.reduce((p: number, c: any) => p + (c.progressPercentage || 0), 0) / tasksForTheProject.length).toFixed(0) : 0 })
  })
}

// get project details
export async function getProjectDetail(projectId: string) {
  try {
    return await ProjectSchema.findById(projectId).exec()
  } catch (error) {
    console.error(error)
    throw error
  };
};

export async function createTask(payload: any, projectId: string, userToken: string, userObj: any) {
  let isEligible = await checkRoleScope(userObj.role, "project-create-task");
  if (!isEligible) throw new APIError("Unauthorized Action.", 403);
  const taskPayload = await formatTaskPayload(payload, projectId)
  const options = {
    url: `${TASKS_URL}/task/create`,
    body: { ...taskPayload },
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` },
    json: true
  }
  const createdTask: any = await httpRequest(options)
  createLog({ activityType: ACTIVITY_LOG.CREATE_TASK_FROM_PROJECT, taskId: createdTask.id, projectId, activityBy: userObj._id })
  return createdTask
}

async function formatTaskPayload(payload: any, projectId: string) {
  return { ...payload, projectId }
  const projectInfo: any = await ProjectSchema.findById(projectId).exec()
  const memberRoles = await Promise.all(
    projectInfo.members.map((member: string) => userRoleAndScope(member))
  )
  let approvers = []
  let endorsers = []
  let viewers = []
  let supporters = []
  let assignee
  if (payload.assignee && !Types.ObjectId.isValid(payload.assignee)) {
    const filteredAssignees = memberRoles.filter((role: any) => (role.data.global[0] == payload.assignee))
    if (filteredAssignees.length > 1) {
      throw new APIError(PROJECT_ROUTER.MORE_THAN_ONE_RESULT_FOUND)
    } else {
      assignee = filteredAssignees[0]
    }
  } else {
    assignee = payload.assignee
  }
  approvers = memberRoles.filter((role: any) => (payload.approvers || []).includes(role.data.global[0]))
  endorsers = memberRoles.filter((role: any) => (payload.endorsers || []).includes(role.data.global[0]))
  viewers = memberRoles.filter((role: any) => (payload.viewers || []).includes(role.data.global[0]))
  supporters = memberRoles.filter((role: any) => (payload.supporters || []).includes(role.data.global[0]))
  return { ...payload, assignee, approvers, endorsers, viewers, supporters }
}

export async function getProjectTasks(projectId: string, userToken: string) {
  const options = {
    url: `${TASKS_URL}/task/getTasksByProject`,
    body: { projectId },
    headers: { 'Authorization': `Bearer ${userToken}` },
    method: 'POST',
    json: true
  }
  return await httpRequest(options)
}

export async function editTask(projectId: string, taskId: string, userObj: any, userToken: string, payload: any) {
  let isEligible = await checkRoleScope(userObj.role, "edit-task-progress-dates");
  if (!isEligible) throw new APIError("Unauthorized Action.", 403);
  const projectDetail: any = await ProjectSchema.findById(projectId).exec()
  if (!projectDetail) {
    throw new Error(PROJECT_ROUTER.PROJECT_NOT_EXISTS)
  }
  if (!((projectDetail as any).members || []).includes(userObj._id)) {
    throw new Error(PROJECT_ROUTER.NOT_MEMBER_OF_PROJECT)
  }
  const options = {
    url: `${TASKS_URL}/task/${taskId}/soft-edit`,
    body: payload,
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` },
    json: true
  }
  const updatedTask = await httpRequest(options)
  createLog({ activityBy: userObj._id, activityType: ACTIVITY_LOG.TASK_DATES_UPDATED, taskId, projectId })
  return updatedTask
}

export async function linkTask(projectId: string, taskId: string, userToken: string, userId: string) {
  if (!taskId) {
    throw new Error(PROJECT_ROUTER.TASK_REQUIRED_FOR_LINKING)
  }
  const options = {
    url: `${TASKS_URL}/task/${taskId}/soft-edit`,
    body: { projectId },
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` },
    json: true
  }
  const updatedTask: any = await httpRequest(options)
  createLog({ activityBy: userId, activityType: ACTIVITY_LOG.TASK_LINKED_TO_PROJECT, taskId, projectId })
  return updatedTask
}

export async function ganttChart(projectId: string, userToken: string) {
  const projectDetail = await ProjectSchema.findById(projectId).exec()
  const options = {
    url: `${TASKS_URL}/task/getTasksWithSubTasks`,
    method: 'POST',
    body: { projectIds: [projectId] },
    headers: { 'Authorization': `Bearer ${userToken}` },
    json: true
  }
  const tasks = await httpRequest(options)
  return { ...(projectDetail as any).toJSON(), tasks }
}

export async function projectMembers(id: string) {
  let [project, formattedRoleObjs]: any = await Promise.all([
    ProjectSchema.findById(id).exec(),
    role_list()
  ])
  if (!project) throw new Error("Project Not Found.");
  const userIds = [...project.members, project.createdBy]
  const usersRoles = await Promise.all(userIds.map((userId: string) => userRoleAndScope(userId)))
  return userIds.map((user: any, i: number) => ({
    value: user,
    key: formatUserRole((usersRoles.find((role: any) => role.user == user) as any).data.global[0], formattedRoleObjs.roles)
  }))
}

export async function getTaskDetail(projectId: string, id: string, userId: string, userToken: string) {
  const projectDetail: any = await ProjectSchema.findById(projectId).exec()
  if (!projectDetail.members.includes(userId) && projectDetail.createdBy != userId) {
    throw new APIError(`You dont have access to this project`)
  }
  const options = {
    url: `${TASKS_URL}/task/${id}/detail?isFromProject=${true}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${userToken}` },
    json: true
  }
  return await httpRequest(options)
}

function getPercentageByInstallment(installment: number) {
  let percentage = 10, installmentType, phase
  switch (installment) {
    case 1:
      percentage = 10
      installmentType = `1st Installment`
      phase = `Maturation`
      break;
    case 2:
      phase = `Implementation`
      percentage = 40
      installmentType = `2nd Installment`
      break;
    case 3:
      phase = `Implementation`
      percentage = 40
      installmentType = `3rd Installment`
      break;
    case 4:
      percentage = 10
      phase = `Implementation`
      installmentType = `4th Installment`
      break;
    default:
      break;
  }
  return { percentage, installmentType, phase }
}
export async function getFinancialInfo(projectId: string) {
  const projectDetail = await ProjectSchema.findById(projectId).exec()
  const { fundsReleased, fundsUtilised, projectCost, citiisGrants }: any = projectDetail
  const documentIds = fundsReleased.map((fund: any) => fund.document).concat(fundsUtilised.map((fund: any) => fund.document)).filter((v: any) => !!v)
  const documents = await documentsList(documentIds)
  const fundsReleasedData = Array(4).fill(0).map((it, index) => index + 1).map((fund: any) => {
    const { installmentType, percentage, phase } = getPercentageByInstallment(fund)
    const items = fundsReleased.filter((fundReleased: any) =>
      (!fundReleased.deleted && fundReleased.subInstallment && (fund == fundReleased.installment)
      )).map((item: any) => ({ ...item.toJSON(), document: documents.find((d: any) => d.id == item.document) }))
    return {
      phase,
      installment: installmentType,
      percentage,
      // Filter empty data
      items,
      installmentLevelTotal: items.reduce((p: number, item: any) => p + (item.cost || 0), 0)
    }
  })
  const fundsUtilisedData = Array(4).fill(0).map((it, index) => index + 1).map((fund: any) => {
    const { installmentType, percentage, phase } = getPercentageByInstallment(fund)
    const items = fundsUtilised.filter((fundReleased: any) =>
      (!fundReleased.deleted && fundReleased.subInstallment && (fund == fundReleased.installment)
      )).map((item: any) => ({ ...item.toJSON(), document: documents.find((d: any) => d.id == item.document) }))
    return {
      phase,
      installment: installmentType,
      percentage,
      // Filter empty data
      items,
      installmentLevelTotal: items.reduce((p: number, item: any) => p + (item.cost || 0), 0)
    }
  })
  return {
    projectCost: projectCost,
    citiisGrants: citiisGrants,
    fundsReleased: {
      info: fundsReleasedData,
      total: fundsReleasedData.reduce((p: number, c: any) => p + c.installmentLevelTotal, 0)
    },
    fundsUtilised: {
      info: fundsUtilisedData,
      total: fundsUtilisedData.reduce((p: number, c: any) => p + c.installmentLevelTotal, 0)
    }
  }
}

export async function addFundReleased(projectId: string, payload: any, user: any) {
  if (!payload.installment) {
    throw new APIError(`Installment is required`)
  }
  const isEligible = await checkRoleScope(user.role, `manage-project-released-fund`)
  if(!isEligible){
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
  const fund: any = await ProjectSchema.findById(projectId).exec()
  const { fundsReleased } = fund
  const otherFunds = fundsReleased.filter((fund: any) => fund.installment != payload.installment)
  const matchedFunds = fundsReleased.filter((fund: any) => fund.installment == payload.installment)
  let matchedFundsWithData = matchedFunds.length == 1 && !matchedFunds[0].cost ? [] : matchedFunds
  const updates = {
    fundsReleased: otherFunds.concat(matchedFundsWithData).concat([
      {
        subInstallment: matchedFundsWithData.length + 1,
        installment: payload.installment, document: payload.document, cost: payload.cost,
        createdAt: new Date(), modifiedAt: new Date(), modifiedBy: user._id
      }
    ]).sort((a: any, b: any) => a.installment - b.installment)
  }
  const updatedFund = await ProjectSchema.findByIdAndUpdate(projectId, { $set: updates }, { new: true }).exec()
  createLog({ activityType: ACTIVITY_LOG.ADDED_FUND_RELEASE, projectId, updatedCost: payload.cost, activityBy: user._id })
  return updatedFund
}

export async function addFundsUtilized(projectId: string, payload: any, user: any) {
  const isEligible = await checkRoleScope(user.role, `manage-project-utilized-fund`)  
  if(!isEligible){
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
  if (!payload.installment) {
    throw new Error(`Installment is required`)
  }
  const project: any = await ProjectSchema.findById(projectId).exec()
  const { fundsUtilised } = project
  const otherFunds = fundsUtilised.filter((fund: any) => fund.installment != payload.installment)
  const matchedFunds = fundsUtilised.filter((fund: any) => fund.installment == payload.installment)
  const updates = {
    fundsUtilised: otherFunds.concat(matchedFunds).concat([
      {
        subInstallment: matchedFunds.length + 1,
        installment: payload.installment, document: payload.document, cost: payload.cost,
        createdAt: new Date(), modifiedAt: new Date(), modifiedBy: user._id
      }
    ]).sort((a: any, b: any) => a.installment - b.installment)
  }
  const updatedProject = await ProjectSchema.findByIdAndUpdate(projectId, { $set: updates }, { new: true }).exec()
  createLog({ activityType: ACTIVITY_LOG.ADDED_FUND_UTILIZATION, projectId, updatedCost: payload.cost, activityBy: user._id })
  return updatedProject
}

export async function updateReleasedFund(projectId: string, payload: any, user: any) {
  const isEligible = await checkRoleScope(user.role, `manage-project-released-fund`)
  if(!isEligible){
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
  const { document, cost, _id } = payload
  let updates: any = {}
  updates = { ...updates, modifiedAt: new Date(), modifiedBy: user._id }
  updates['fundsReleased.$.document'] = document
  updates['fundsReleased.$.cost'] = cost
  const updatedProject: any = await ProjectSchema.findOneAndUpdate({ _id: projectId, 'fundsReleased._id': _id }, { $set: updates }).exec()
  createLog({ activityType: ACTIVITY_LOG.UPDATED_FUND_RELEASE, oldCost: updatedProject.cost, updatedCost: payload.cost, projectId, activityBy: user._id })
  return updatedProject
  // if(!payload.installment || !payload.subInstallment){
  //   throw new APIError(`Installment is required`)
  // }
  // const project: any = await ProjectSchema.findById(projectId).exec()
  // const { fundsReleased } = project.toJSON()
  // const otherFunds = fundsReleased.filter((fund: any) => fund.installment != payload.installment)
  // const matchedFunds = fundsReleased.filter((fund: any) => fund.installment == payload.installment)
  // const matchedSubFund = matchedFunds.find((fund: any) => fund.subInstallment == payload.installment)
  // const updates = {fundsReleased: otherFunds.concat(matchedFunds.filter((fund: any) => fund.subInstallment != payload.installment)).concat([
  //   {
  //     ...matchedSubFund, document: payload.document, cost: payload.cost, modifiedAt: new Date(), modifiedBy: userId
  //   }
  // ]).sort((a: any, b: any) => a.installment - b.installment)}
  // return await ProjectSchema.findByIdAndUpdate(projectId, { $set: updates }, {new: true}).exec()
}

export async function updateUtilizedFund(projectId: string, payload: any, user: any) {
  const isEligible = await checkRoleScope(user.role, `manage-project-utilized-fund`)
  if(!isEligible){
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
  // if(!payload.installment || !payload.subInstallment){
  //   throw new Error(`Installment is required`)
  // }
  // const project: any = await ProjectSchema.findById(projectId).exec()
  // const { fundsUtilised } = project.toJSON()
  // const otherFunds = fundsUtilised.filter((fund: any) => fund.installment != payload.installment)
  // const matchedFunds = fundsUtilised.filter((fund: any) => fund.installment == payload.installment)
  // const matchedSubFund = matchedFunds.find((fund: any) => fund.subInstallment == payload.installment)
  // const updates = {fundsUtilised: otherFunds.concat(matchedFunds.filter((fund: any) => fund.subInstallment != payload.installment)).concat([
  //   {
  //     ...matchedSubFund, document: payload.document, cost: payload.cost, modifiedAt: new Date(), modifiedBy: userId
  //   }
  // ]).sort((a: any, b: any) => a.installment - b.installment)}
  // return await ProjectSchema.findByIdAndUpdate(projectId, { $set: updates }, {new: true}).exec()
  const { document, cost, _id } = payload
  let updates: any = {}
  updates = { ...updates, modifiedAt: new Date(), modifiedBy: user._id }
  updates['fundsReleased.$.document'] = document
  updates['fundsReleased.$.cost'] = cost
  const updatedProject: any = await ProjectSchema.findOneAndUpdate({ _id: projectId, 'fundsReleased._id': _id }, { $set: updates }).exec()
  createLog({ activityType: ACTIVITY_LOG.UPDATED_FUND_UTILIZATION, projectId, oldCost: updatedProject.cost, updatedCost: payload.cost, activityBy: user._id })
  return updatedProject
}

export async function deleteReleasedFund(projectId: string, payload: any, user: any) {
  const isEligible = await checkRoleScope(user.role, `manage-project-released-fund`)
  if(!isEligible){
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
  const { document, cost, _id } = payload
  let updates: any = {}
  updates = { ...updates, modifiedAt: new Date(), modifiedBy: user._id }
  updates['fundsReleased.$.deleted'] = true
  const updatedProject: any = await ProjectSchema.findOneAndUpdate({ _id: projectId, 'fundsReleased._id': _id }, { $set: updates }).exec()
  // createLog({activityType: ACTIVITY_LOG.UPDATED_FUND_RELEASE, oldCost: updatedProject.cost, updatedCost: payload.cost, projectId, activityBy: userId})
  return updatedProject
}

export async function deleteUtilizedFund(projectId: string, payload: any, user: any) {
  const isEligible = await checkRoleScope(user.role, `manage-project-utilized-fund`)
  if(!isEligible){
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
  const { document, cost, _id } = payload
  let updates: any = {}
  updates = { ...updates, modifiedAt: new Date(), modifiedBy: user._id }
  updates['fundsReleased.$.deleted'] = true
  const updatedProject: any = await ProjectSchema.findOneAndUpdate({ _id: projectId, 'fundsReleased._id': _id }, { $set: updates }).exec()
  // createLog({activityType: ACTIVITY_LOG.UPDATED_FUND_UTILIZATION, projectId, oldCost: updatedProject.cost, updatedCost: payload.cost, activityBy: userId})
  return updatedProject
}

export function importExcelAndFormatData(filePath: string) {
  if (!['.xlsx', ".csv"].includes(extname(filePath))) {
    unlinkSync(filePath);
    throw new APIError(`please upload valid xlsx/csv file`)
  }
  let workBook = xlsx.readFile(filePath);
  xlsx.writeFile(workBook, filePath)
  unlinkSync(filePath);
  if (!workBook.SheetNames) { throw new APIError("not a valid sheet") }
  var excelFormattedData: any[] = xlsx.utils.sheet_to_json(workBook.Sheets[workBook.SheetNames[0]]);
  return excelFormattedData
}

export async function uploadTasksExcel(filePath: string, projectId: string, userToken: string, userObj: any) {
  const roleData: any = await role_list()
  const roleNames = roleData.roles.map((role: any) => role.roleName)
  const excelFormattedData = importExcelAndFormatData(filePath)
  const validatedTaskData = excelFormattedData.map(data => validateObject(data, roleNames))
  const tasksDataWithIds = await Promise.all(validatedTaskData.map(taskData => formatTasksWithIds(taskData, projectId, userObj)))
  await Promise.all(tasksDataWithIds.map(taskData => createTask(taskData, projectId, userToken, userObj)))
}

async function formatTasksWithIds(taskObj: any, projectId: string, userObj: any) {
  const [projectData, memberRoles] = await Promise.all([
    ProjectSchema.findById(projectId).exec(),
    projectMembers(projectId)
  ])
  // if ((tags && !Array.isArray(tags)) || (taskObj.approvers && !Array.isArray(taskObj.approvers)) || (taskObj.viewers && !Array.isArray(taskObj.viewers)) || (taskObj.supporters && !Array.isArray(taskObj.supporters))) {
  //   throw new APIError(TASK_ERROR.INVALID_ARRAY);
  // }
  taskObj.approvers = Object.keys(taskObj).filter(key => key == `approver`)
  const approverIds = memberRoles.filter((memberRole: any) => taskObj.approvers.includes(memberRole.key)).map(val => val.key)
  const endorserIds = memberRoles.filter((memberRole: any) => taskObj.endorsers.includes(memberRole.key)).map(val => val.key)
  const viewerIds = memberRoles.filter((memberRole: any) => taskObj.viewers.includes(memberRole.key)).map(val => val.key)
  const assigneeId = memberRoles.filter((memberRole: any) => [taskObj.assignee].includes(memberRole.key)).map(val => val.key)

  if (approverIds.length != taskObj.approvers.length) {
    throw new APIError(TASK_ERROR.USER_NOT_PART_OF_PROJECT)
  }
  if (endorserIds.length != taskObj.endorsers.length) {
    throw new APIError(TASK_ERROR.USER_NOT_PART_OF_PROJECT)
  }
  if (viewerIds.length != taskObj.viewers.length) {
    throw new APIError(TASK_ERROR.USER_NOT_PART_OF_PROJECT)
  }
  if (!assigneeId) {
    throw new APIError(TASK_ERROR.ASSIGNEE_REQUIRED)
  }
  taskObj = {
    ...taskObj,
    projectId,
    assignee: assigneeId,
    approvers: approverIds,
    endorsers: endorserIds,
    viewers: viewerIds,
  }
  const { assignee, approvers, endorsers } = taskObj
  if (Array.from(new Set(taskObj.approvers || [])).length != (taskObj.approvers || []).length) {
    throw new APIError(TASK_ERROR.DUPLICATE_APPROVERS_FOUND)
  }
  if (Array.from(new Set(taskObj.endorsers || [])).length != (taskObj.endorsers || []).length) {
    throw new APIError(TASK_ERROR.DUPLICATE_ENDORSERS_FOUND)
  }
  if (assignee && ((taskObj.approvers || []).concat(taskObj.endorsers || [])).includes(assignee)) {
    throw new APIError(TASK_ERROR.ASSIGNEE_ERROR)
  }
  if ((taskObj.approvers || []).some((approver: any) => (taskObj.endorsers || []).includes(approver))) {
    throw new APIError(TASK_ERROR.APPROVERS_EXISTS)
  }
  return taskObj
}

function validateObject(data: any, roleNames: any, projectMembersData?: any) {
  let errorRole
  if (!data.name || !data.name.trim().length) {
    throw new APIError(TASK_ERROR.TASK_NAME_REQUIRED)
  }
  data.approvers = Object.keys(data).filter(key => ['approver1',`approver2`, `approver3`].includes(key)).reduce((p,c) => p.concat(`, ${data[c]}`) ,'')
  data.endorsers = Object.keys(data).filter(key => ['endorser1',`endorser2`, `endorser3`].includes(key)).reduce((p,c) => p.concat(`, ${data[c]}`) ,'')
  data.viewers = Object.keys(data).filter(key => ['viewer1',`viewer2`, `viewer3`].includes(key)).reduce((p,c) => p.concat(`, ${data[c]}`) ,'')
  if (!data.assignee || !data.assignee.trim().length) {
    throw new APIError(`Assignee is required for task ${data.name}`)
  }
  const approvers = data.approvers.split(',').map((value: string) => value.trim()).filter((v: string) => !!v)
  const endorsers = data.endorsers.split(',').map((value: string) => value.trim()).filter((v: string) => !!v)
  const viewers = data.endorsers.split(',').map((value: string) => value.trim()).filter((v: string) => !!v)
  if (!roleNames.includes(data.assignee.trim())) {
    throw new APIError(`Assignee not exists for task ${data.name}`)
  }
  // Validate Approvers
  if (approvers.some((approver: string) => {
    errorRole = approver
    return !roleNames.includes(approver)
  })) {
    throw new APIError(`Approver ${errorRole} not exists in the system at task ${data.name}`)
  }
  // Validate Endorsers  
  if (endorsers.some((endorser: string) => {
    errorRole = endorser
    return !roleNames.includes(endorser)
  })) {
    throw new APIError(`Endorser ${errorRole} not exists in the system at task ${data.name}`)
  }
  // Validate Viewers
  if (viewers.some((viewer: string) => {
    errorRole = viewer
    return !roleNames.includes(viewer)
  })) {
    throw new APIError(`Viewer ${errorRole} not exists in the system at task ${data.name}`)
  }
  return {
    name: data.name,
    description: data.description,
    initialStartDate: data.initialStartDate,
    initialDueDate: data.initialDueDate,
    // Validate ids
    // tags: data.tags,
    assignee: data.assignee,
    viewers: data.viewers,
    approvers: data.approvers,
    endorsers: data.endorsers,
    stepId: data.stepId,
    pillarId: data.pillarId,
    isFromExcel: true,
    documents: data.documents
  }
}

export async function projectCostInfo(projectId: string, projectCost: number) {
  try {
    return await ProjectSchema.findByIdAndUpdate(projectId, { $set: { projectCost } }, { new: true })
  }
  catch (err) {
    throw err
  }
}

export async function citiisGrantsInfo(projectId: string, citiisGrants: number) {
  try {
    return await ProjectSchema.findByIdAndUpdate(projectId, { $set: { citiisGrants } }, { new: true })
  }
  catch (err) {
    throw err
  }
}