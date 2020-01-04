import { MISSING, PROJECT_ROUTER, ACTIVITY_LOG, TASK_ERROR, USER_ROUTER, COMPLIANCES, DOCUMENT_ROUTER } from "../utils/error_msg";
import { project as ProjectSchema, project } from "./project_model";
import { Types } from "mongoose";
import { tags } from "../tags/tag_model";
import { themes } from "./theme_model";
import { userRoleAndScope, roles_list, role_list } from "../role/module";
import { taskModel } from "./task_model";
import { workflowModel } from "./workflow_model";
import { checkCapability } from "../utils/rbac";
import { httpRequest, checkRoleScope } from "../utils/role_management";
import { TASKS_URL } from "../utils/urls";
import { getUserDetail, userDetails, getFullNameAndMobile, sendNotification } from "../users/module";
import { userFindMany, userFindOne } from "../utils/users";
import { APIError } from "../utils/custom-error";
import { create as createLog } from "../log/module";
import { documentsList, updateUserInDOcs } from "../documents/module";
import { unlinkSync } from "fs";
import { extname } from "path";
import * as xlsx from "xlsx";
import { userRolesNotification } from "../notifications/module";
import { nodemail } from "../utils/email";
import { getTemplateBySubstitutions } from "../email-templates/module";
import { OpenCommentsModel } from "./open-comments-model";
import { phaseSchema } from "../phase/model";
import { some } from "bluebird";
import { PillarSchema } from "../pillars/model";
import { StepsSchema } from "../steps/model";

//  Create Project 
export async function createProject(reqObject: any, user: any) {
  try {
    if (!reqObject.reference || !reqObject.name /*|| !reqObject.startDate || !reqObject.endDate*/) {
      throw new Error(MISSING);
    }
    // if (new Date(reqObject.startDate) > new Date(reqObject.endDate)) {
    //   throw new Error("Start date must less than end date.")
    // }
    let isEligible = await checkRoleScope(user.role, "manage-project");
    if (!isEligible) {
      throw new APIError("Unauthorized Action.", 403);
    }
    // if (reqObject.name && (/[ ]{2,}/.test(reqObject.name) || !/[A-Za-z0-9  -]+$/.test(reqObject.name))) throw new Error("you have entered invalid name. please try again.")
    const createdProject = await ProjectSchema.create({
      createdBy: user._id,
      name: reqObject.name,
      startDate: reqObject.startDate,
      endDate: reqObject.endDate,
      reference: reqObject.reference,
      city: reqObject.cityname,
      summary: reqObject.description || "N/A",
      maturationStartDate: { date: reqObject.maturationStartDate, modifiedBy: user._id },
      maturationEndDate: { date: reqObject.maturationEndDate, modifiedBy: user._id },
      fundsReleased: [],
      fundsUtilised: [],
      funds: []
      // phases: reqObject.phases
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
    let modifiedFields = []
    let [preProjectRecord, isEligible]: any = await Promise.all([
      project.findById(id).exec(),
      checkRoleScope(user.role, "manage-project")
    ])
    // let isEligible = await checkRoleScope(user.role, "manage-project");
    if (!isEligible) throw new APIError("Unauthorized Action.", 403);

    if (reqObject.startDate || reqObject.endDate) {
      if (new Date(reqObject.startDate) > new Date(reqObject.endDate)) throw new Error("Start date must less than end date.")
      obj.startDate = reqObject.startDate
      obj.endDate = reqObject.endDate
    };
    if (reqObject.reference) {
      if (preProjectRecord.name != reqObject.name) modifiedFields.push("Reference Id")
      obj.reference = reqObject.reference;
    }
    if (reqObject.name) {
      if (reqObject.name && (/[ ]{2,}/.test(reqObject.name) || !/[A-Za-z0-9  -]+$/.test(reqObject.name))) throw new Error("you have entered invalid name. please try again.")
      if (preProjectRecord.name != reqObject.name) modifiedFields.push("Name")
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
    if (reqObject.phases) {
      obj.phases = reqObject.phases
    }
    const updatedProject = await ProjectSchema.findByIdAndUpdate(id, { $set: obj }, { new: true }).exec();
    return updatedProject
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export async function RemoveProjectMembers(projectId: string, userId: string, token: string) {
  try {
    // let projectTasks: any = await memberExistInProjectTask(projectId, userId, token)
    // if (projectTasks.success) return { success: false, tasks: projectTasks.tasks }
    const previousProjectData: any = await ProjectSchema.findById(projectId).exec()
    let members = previousProjectData.members.filter((id: any) => id != userId)
    const updatedProject: any = await ProjectSchema.findByIdAndUpdate(projectId, { $set: { members } }, { new: true }).exec()
    return { success: true, project: updatedProject }
  } catch (err) {
    throw err
  }
}

export async function replaceProjectMember(projectId: string, objBody: any, token: string) {
  try {
    if (!objBody || !objBody.oldUser || !objBody.newUser || !projectId) throw new Error("Required mandatory fields.")
    const ProjectData: any = await ProjectSchema.findById(projectId).exec()
    // if (!ProjectData.members.includes(objBody.newUser)) throw new Error("member is not a project member.")
    let success: any = await replaceProjectTaskUser(projectId, objBody.oldUser, objBody.newUser, token)
    if (success && !success.success) throw new Error(success)
    let members = [... new Set((ProjectData.members.filter((id: any) => id != objBody.oldUser)).concat([objBody.newUser]))]
    const updatedProject: any = await ProjectSchema.findByIdAndUpdate(projectId, { $set: { members } }, { new: true }).exec()
    return { message: "Replaced new user successfully." }
  } catch (err) {
    throw err
  }
}

export async function replaceProjectTaskUser(projectId: string, userId: string, replaceTo: string, userToken: string) {
  const options = {
    url: `${TASKS_URL}/task/replace-user/?projectId=${projectId}`,
    body: { oldUser: userId, updatedUser: replaceTo },
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` },
    json: true
  }
  return await httpRequest(options)
}

export async function memberExistInProjectTask(projectId: string, userId: string, userToken: string) {
  const options = {
    url: `${TASKS_URL}/task/memberExistInProjectTask`,
    body: { projectId, userId },
    headers: { 'Authorization': `Bearer ${userToken}` },
    method: 'POST',
    json: true
  }
  return await httpRequest(options)
}

export async function manageProjectMembers(id: string, members: string[], userId: string, userRole: any) {
  members = Array.from(new Set(members))
  const isEligible = await checkRoleScope(userRole, `project-add-core-team`)
  if (!isEligible) {
    throw new APIError(TASK_ERROR.UNAUTHORIZED_PERMISSION)
  }
  const previousProjectData: any = await ProjectSchema.findById(id).exec()
  if (members.includes(userId) && !previousProjectData.members.includes(userId)) {
    throw new APIError(`You are trying to add yourself as project member`)
  }
  const updatedProject: any = await ProjectSchema.findByIdAndUpdate(id, { $set: { members } }, { new: true }).exec()
  const removedUserIds = previousProjectData.members.filter((member: string) => !updatedProject.members.includes(member))
  const addedUserIds = updatedProject.members.filter((member: string) => !previousProjectData.members.includes(member))
  createLog({ activityType: ACTIVITY_LOG.PROJECT_MEMBERS_UPDATED, activityBy: userId, projectId: id, addedUserIds, removedUserIds })
  return updatedProject
}

export async function getProjectMembers(id: string, userId: string) {
  let userRoles = await userRoleAndScope(userId);
  let userRole = userRoles.data[0];
  const [viewMyAccess, viewAllAccess, manageAccess] = await Promise.all([
    checkRoleScope(userRole, "view-my-project"),
    checkRoleScope(userRole, "view-all-projects"),
    checkRoleScope(userRole, "manage-project")
  ])

  if (!viewMyAccess && !viewAllAccess && !manageAccess) {
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS);
  }
  const { members }: any = await ProjectSchema.findById(id).exec()
  const [users, formattedRoleObjs]: any = await Promise.all([
    userFindMany('_id', members, { firstName: 1, lastName: 1, middleName: 1, email: 1, phone: 1, is_active: 1 }),
    role_list()
  ])
  const usersRoles = await Promise.all(members.map((user: string) => userRoleAndScope(user)))
  return members.map((user: any, i: number) => ({
    ...(users.find((_user: any) => _user._id == user)),
    role: formatUserRole((usersRoles.find((role: any) => role.user == user) as any).data[0], formattedRoleObjs.roles)
  }))
  // return users.map((user: any, i: number) => ({ ...user, role: formatUserRole((usersRoles.find((role: any) => role.user == user._id) as any).data[0], formattedRoleObjs.roles) }))
}

function formatUserRole(role: string[], formattedRoleObjs: any) {
  // let userRole: any = formattedRoleObjs.find((roleObj: any) => roleObj.role === role);
  // return userRole ? userRole.roleName : role;
  return role ? role.map((userRole: string) => {
    let roleObj = formattedRoleObjs.find(({ role: rolecode }: any) => rolecode == userRole)
    return roleObj ? roleObj.roleName : userRole
  }) : ["N/A"]
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
    let isEligible = await checkRoleScope(userObj.role, "manage-project");
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
    // let isEligible = await checkRoleScope(userObj.role, "create-tag");
    // if (!isEligible) throw new APIError("Unauthorized Action.", 403);
    let { firstName, lastName, middleName, countryCode, phone } = userObj;
    let fullName = (firstName ? firstName + " " : "") + (middleName ? middleName + " " : "") + (lastName ? lastName : "");

    // let userNotification = await userRolesNotification(userObj._id,"tagAdd");

    // if(userNotification.email){
    //   let templatInfo = await getTemplateBySubstitutions('tagAdd', { fullName, otp: authOtp.otp });
    //   nodemail({
    //     email: userObj.email,
    //     subject: templatInfo.subject,
    //     html: templatInfo.content
    //   })
    // }

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
    // let isEligible = await checkRoleScope(userObj.role, "edit-tag");
    // if (!isEligible) throw new APIError("Unauthorized Action.", 403);
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
    // let isEligible = await checkRoleScope(userObj.role, "edit-tag");
    // if (!isEligible) throw new APIError("Unauthorized Action.", 403);
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
export async function getProjectsList(userId: any, userToken: string, userRole: any, currentPage: number, limit = 30) {
  try {
    let query: any = { members: { $in: [userId] } }
    // let userProjects: any = await userRoleAndScope(userId);
    // if (!userProjects) throw new Error("user have no projects");
    //const { docs: list, page, pages } = await ProjectSchema.paginate({ $or: [{ createdBy: userId }, { members: { $in: [userId] } }] })
    const [isEligible1, isEligible2] = await Promise.all([
      checkRoleScope(userRole, `view-all-projects`),
      checkRoleScope(userRole, `manage-project`),
    ])
    if (isEligible1 || isEligible2) {
      query = {}
    }
    let { docs: list, page, pages } = await ProjectSchema.paginate(query, { page: Number(currentPage), limit: Number(limit), sort: { createdAt: -1 }})
    const projectIds = (list || []).map((_list) => _list.id);
    list = await Promise.all(list.map((proObj)=>mapPhases(proObj)))
    return { docs: await mapProgressPercentageForProjects(projectIds, userToken, list), page, pages };
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function mapPhases(projectObj: any){
  return {...projectObj.toJSON(), phases: await listPhasesOfProject(projectObj._id)}
} 

function getCurrentPhase(projectObj: any) {
  return (projectObj.phases && projectObj.phases.length ? projectObj.phases.find((phaseObj: any) =>
    (new Date(phaseObj.startDate) <= new Date() && new Date(phaseObj.endDate) >= new Date())
  ) : {})
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
    const tasksForTheProject = (projectRelatedTasks as any).filter((task: any) => task.projectId == _list.id && task.status != 8)
    return ({
      ..._list, progressPercentage: tasksForTheProject.length ? (tasksForTheProject.reduce((p: number, c: any) => p + (c.progressPercentage || 0), 0) / tasksForTheProject.length).toFixed(0) : 0,
      phase: getCurrentPhase(_list) || {}
    })
  })
}

// get project details
export async function getProjectDetail(projectId: string, userToken: string) {
  try {
    let projectDetail: any = await ProjectSchema.findById(projectId).populate({ path: 'phases' }).exec()
    return (await mapProgressPercentageForProjects([projectId], userToken, [projectDetail.toJSON()]))[0]
  } catch (error) {
    console.error(error)
    throw error
  };
};

export async function createTask(payload: any, projectId: string, userToken: string, userObj: any) {
  let isEligible = await checkRoleScope(userObj.role, "project-create-task");
  if (!isEligible) throw new APIError("Unauthorized Action.", 403);
  const taskPayload = await formatTaskPayload(payload, projectId)
  // if (!payload.isCompliance && (payload.assignee == userObj._id)) {
  //   throw new APIError(TASK_ERROR.CREATOR_CANT_BE_ASSIGNEE)
  // }
  if (payload.isCompliance && (!payload.approvers || !payload.approvers.length)) {
    throw new APIError(TASK_ERROR.APPROVERS_REQUIRED)
  }
  const options = {
    url: `${TASKS_URL}/task/create`,
    body: { ...taskPayload },
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` },
    json: true
  }
  const createdTask: any = await httpRequest(options)
  createLog({ activityType: ACTIVITY_LOG.CREATE_TASK_FROM_PROJECT, taskId: createdTask._id, projectId, activityBy: userObj._id })
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
    const filteredAssignees = memberRoles.filter((role: any) => (role.data[0] == payload.assignee))
    if (filteredAssignees.length > 1) {
      throw new APIError(PROJECT_ROUTER.MORE_THAN_ONE_RESULT_FOUND)
    } else {
      assignee = filteredAssignees[0]
    }
  } else {
    assignee = payload.assignee
  }
  approvers = memberRoles.filter((role: any) => (payload.approvers || []).includes(role.data[0]))
  endorsers = memberRoles.filter((role: any) => (payload.endorsers || []).includes(role.data[0]))
  viewers = memberRoles.filter((role: any) => (payload.viewers || []).includes(role.data[0]))
  supporters = memberRoles.filter((role: any) => (payload.supporters || []).includes(role.data[0]))
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

export async function taskProjectDetails(projectId: string) {
  return project.findById(projectId).exec()
};

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

export async function addReleasedInstallment(projectId: string, payload: any, user?: any) {
  const projectDetail: any = await ProjectSchema.findById(projectId).exec()
  // if(!payload.installment){
  //   throw new APIError('Installment is required') 
  // }
  const isEligible = await checkRoleScope(user.role, `manage-project-released-fund`)
  if (!isEligible) {
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
  const finalPayload = payload.fundsReleased.map((fund: any, index: number) => {
    if (!fund.phase) {
      throw new APIError(`Phase is required`)
    }
    if (!fund.percentage) {
      throw new APIError(`Percentage is required`)
    }
    return { ...fund, installment: index + 1 }
    return {
      installment: index + 1,
      phase: fund.phase,
      percentage: fund.percentage
    }
  })
  const overAllPercentage = finalPayload.reduce((p: number, fund: any) => p + Number(fund.percentage), 0)
  // if(projectDetail.fundsReleased.some((fund: any) => fund.installment == payload.installment)){
  //   throw new APIError(`Installment already exists`)
  // }
  if (overAllPercentage > 100) {
    throw new APIError(`Percentage should not exceed 100`)
  }
  const updated = await ProjectSchema.findByIdAndUpdate(projectId, { $set: { fundsReleased: finalPayload } }, { new: true }).exec()
  return updated
}

export async function addUtilizedInstallment(projectId: string, payload: any, user?: any) {
  const projectDetail: any = await ProjectSchema.findById(projectId).exec()
  const isEligible = await checkRoleScope(user.role, `manage-project-utilized-fund`)
  if (!isEligible || (!projectDetail.members.includes(user._id))) {
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
  const finalPayload = payload.fundsUtilised.map((fund: any, index: number) => {
    if (!fund.phase) {
      throw new APIError(`Phase is required`)
    }
    if (!fund.percentage) {
      throw new APIError(`Percentage is required`)
    }
    return { ...fund, installment: index + 1 }
    // return {
    //   installment: index + 1,
    //   phase: fund.phase,
    //   percentage: fund.percentage
    // }
  })
  const overAllPercentage = finalPayload.reduce((p: number, fund: any) => p + Number(fund.percentage), 0)
  if (overAllPercentage > 100) {
    throw new APIError(`Percentage should not exceed 100`)
  }
  // if(projectDetail.fundsUtilised.some((fund: any) => fund.installment == payload.installment)){
  //   throw new APIError(`Installment already exists`)
  // }
  const updated = await ProjectSchema.findByIdAndUpdate(projectId, { $set: { fundsUtilised: finalPayload } }, { new: true }).exec()
  return updated
}

export async function getInstallments(projectId: string) {
  const [projectDetail, phases]: any = await Promise.all([
    ProjectSchema.findById(projectId).exec(),
    phaseSchema.find({}).exec()
  ])
  let s1: any = []
  let m = (projectDetail['funds'] || []).map((s: any) => {
    if (!s1.includes(s.installment)) {
      s1.push(s.installment)
      return {
        deletedReleased: s.deletedReleased,
        deletedUtilised: s.deletedUtilised,
        subInstallment: s.subInstallment,
        releasedCost: !(s.deletedReleased)?s.releasedCost:null,
        utilisedCost: !(s.deletedUtilised)?s.utilisedCost:null,
        releasedDocuments: !(s.deletedReleased)?s.releasedDocuments:null,
        utilisedDocuments: !(s.deletedUtilised)?s.utilisedDocuments:null,
        phase: phases.find((phase: any) => phase._id == s.phase),
        percentage: s.percentage
      }
    }
  })
  return m.filter((v: any) => !!v)
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

export async function projectMembers(id: string, currntUser: any) {
  let [project, formattedRoleObjs]: any = await Promise.all([
    ProjectSchema.findById(id).exec(),
    role_list()
  ])
  if (!project) throw new Error("Project Not Found.");
  const userIds = Array.from(new Set([...project.members, currntUser ? currntUser._id : ''].filter(v => v)))
  let userObjs = (await userFindMany("_id", userIds)).map((user: any) => { return { ...user, fullName: (user.firstName ? user.firstName + " " : "") + (user.middleName ? user.middleName + " " : "") + (user.lastName ? user.lastName : "") } })
  // const userIds = project.members
  const usersRoles = await Promise.all(userIds.map((userId: string) => userRoleAndScope(userId)))
  return userIds.map((user: any, i: number) => ({
    isMember: project.members.includes(user),
    value: user,
    fullName: (userObjs.find(({ _id }: any) => _id == user)).fullName,
    key: formatUserRole((usersRoles.find((role: any) => role.user == user) as any).data[0], formattedRoleObjs.roles)
  }))
}

export async function getTaskDetail(projectId: string, id: string, userId: string, userToken: string) {
  const projectDetail: any = await ProjectSchema.findById(projectId).exec()
  // if (!projectDetail.members.includes(userId) && projectDetail.createdBy != userId) {
  //   throw new APIError(`You dont have access to this project`)
  // }
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
      installmentType = `${installment}th Installment`
      break;
  }
  return { percentage, installmentType, phase }
}

export async function getFinancialInfo(projectId: string, userId: string, userRole: any) {
  const [isEligible1, isEligible2, canSeeMyProject, canSeeAllProjects, canManageProject] = await Promise.all([
    checkRoleScope(userRole, `manage-project-released-fund`),
    checkRoleScope(userRole, `manage-project-utilized-fund`),
    checkRoleScope(userRole, `view-my-project`),
    checkRoleScope(userRole, `view-all-projects`),
    checkRoleScope(userRole, `manage-project`)
  ])
  if (!isEligible1 && !isEligible2 && !canSeeMyProject && !canSeeAllProjects && !canManageProject) {
    throw new APIError(PROJECT_ROUTER.FINANCIAL_INFO_NO_ACCESS)
  }
  const projectDetail = await ProjectSchema.findById(projectId).exec()
  const { fundsReleased, fundsUtilised, projectCost, citiisGrants }: any = projectDetail
  const documentIds = fundsReleased.map((fund: any) => (fund.documents || [])).concat(fundsUtilised.map((fund: any) => (fund.documents || []))).reduce((p: any, c: any) => [...p, ...c], []).filter((v: any) => (!!v && Types.ObjectId.isValid(v)))
  const documents = await documentsList(documentIds)
  let phases = await phaseSchema.find({}).exec()
  let fundsReleasedData = fundsReleased.reduce((p: any, fund: any) => {
    const { installmentType } = getPercentageByInstallment(fund.installment)
    const items = fundsReleased.filter((_fund: any) =>
      (!_fund.deleted && _fund.subInstallment && (_fund.installment == fund.installment)
      )).map((item: any) => ({ ...item.toJSON(), documents: documents.filter((d: any) => (item.documents || []).includes(d.id)) }))
    p.push({
      fundsPlanned: Math.round(citiisGrants * (fund.percentage / 100)),
      phase: phases.find(phase => phase.id == fund.phase),
      installment: installmentType,
      percentage: fund.percentage,
      // Filter empty data
      items,
      installmentLevelTotal: items.reduce((p: number, item: any) => p + (item.cost || 0), 0)
    })
    return p
  }, [])
  let ins: any = []
  fundsReleasedData = fundsReleasedData.filter((f: any) => {
    if (!ins.includes(f.installment)) {
      ins.push(f.installment)
      return f
    }
  })
  let fundsUtilisedData = fundsUtilised.reduce((p: any, fund: any) => {
    const { installmentType } = getPercentageByInstallment(fund.installment)
    const items = fundsUtilised.filter((_fund: any) =>
      (!_fund.deleted && _fund.subInstallment && (_fund.installment == fund.installment)
      )).map((item: any) => ({ ...item.toJSON(), documents: documents.filter((d: any) => (item.documents || []).includes(d.id)) }))
    p.push({
      fundsPlanned: Math.round(citiisGrants * (fund.percentage / 100)),
      phase: phases.find(phase => phase.id == fund.phase),
      installment: installmentType,
      percentage: fund.percentage,
      // Filter empty data
      items,
      installmentLevelTotal: items.reduce((p: number, item: any) => p + (item.cost || 0), 0)
    })
    return p
  }, [])
  let _ins: any = []
  fundsUtilisedData = fundsUtilisedData.filter((f: any) => {
    if (!_ins.includes(f.installment)) {
      _ins.push(f.installment)
      return f
    }
  })
  return {
    isMember: (projectDetail as any).members.includes(userId) || ((projectDetail as any).createdBy == userId),
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
  if (!isEligible) {
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
        phase: matchedFunds[0].phase,
        percentage: matchedFunds[0].percentage,
        subInstallment: matchedFundsWithData.length + 1,
        installment: payload.installment, documents: payload.documents, cost: payload.cost,
        createdAt: new Date(), modifiedAt: new Date(), modifiedBy: user._id
      }
    ]).sort((a: any, b: any) => a.installment - b.installment)
  }
  const updatedFund = await ProjectSchema.findByIdAndUpdate(projectId, { $set: updates }, { new: true }).exec()
  createLog({ activityType: ACTIVITY_LOG.ADDED_FUND_RELEASE, projectId, updatedCost: payload.cost, activityBy: user._id })
  return updatedFund
}

export async function addFundsUtilized(projectId: string, payload: any, user: any) {
  const [projectDetail, isEligible]: any = await Promise.all([
    ProjectSchema.findById(projectId).exec(),
    checkRoleScope(user.role, `manage-project-utilized-fund`)
  ])
  if (!isEligible || (!projectDetail.members.includes(user._id))) {
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
  if (!payload.installment) {
    throw new Error(`Installment is required`)
  }
  const { fundsUtilised } = projectDetail
  const otherFunds = fundsUtilised.filter((fund: any) => fund.installment != payload.installment)
  const matchedFunds = fundsUtilised.filter((fund: any) => fund.installment == payload.installment)
  let matchedFundsWithData = matchedFunds.length == 1 && !matchedFunds[0].cost ? [] : matchedFunds
  const updates = {
    fundsUtilised: otherFunds.concat(matchedFundsWithData).concat([
      {
        phase: matchedFunds[0].phase,
        percentage: matchedFunds[0].percentage,
        subInstallment: matchedFundsWithData.length + 1,
        installment: payload.installment, documents: payload.documents, cost: payload.cost,
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
  if (!isEligible) {
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
  const { documents, cost, _id } = payload
  let updates: any = {}
  updates = { ...updates, modifiedAt: new Date(), modifiedBy: user._id }
  updates['fundsReleased.$.documents'] = documents
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
  const [projectDetail, isEligible]: any = await Promise.all([
    ProjectSchema.findById(projectId).exec(),
    checkRoleScope(user.role, `manage-project-utilized-fund`)
  ])
  if (!isEligible || (!projectDetail.members.includes(user._id))) {
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
  const { documents, cost, _id } = payload
  let updates: any = {}
  updates = { ...updates, modifiedAt: new Date(), modifiedBy: user._id }
  updates['fundsUtilised.$.documents'] = documents
  updates['fundsUtilised.$.cost'] = cost
  const updatedProject: any = await ProjectSchema.findOneAndUpdate({ _id: projectId, 'fundsUtilised._id': _id }, { $set: updates }).exec()
  createLog({ activityType: ACTIVITY_LOG.UPDATED_FUND_UTILIZATION, projectId, oldCost: updatedProject.cost, updatedCost: payload.cost, activityBy: user._id })
  return updatedProject
}

export async function deleteReleasedFund(projectId: string, payload: any, user: any) {
  const isEligible = await checkRoleScope(user.role, `manage-project-released-fund`)
  if (!isEligible) {
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
  const [projectDetail, isEligible]: any = await Promise.all([
    ProjectSchema.findById(projectId).exec(),
    checkRoleScope(user.role, `manage-project-utilized-fund`)
  ])
  if (!isEligible || (!projectDetail.members.includes(user._id))) {
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
  const { document, cost, _id } = payload
  let updates: any = {}
  updates = { ...updates, modifiedAt: new Date(), modifiedBy: user._id }
  updates['fundsUtilised.$.deleted'] = true
  const updatedProject: any = await ProjectSchema.findOneAndUpdate({ _id: projectId, 'fundsUtilised._id': _id }, { $set: updates }).exec()
  // createLog({activityType: ACTIVITY_LOG.UPDATED_FUND_UTILIZATION, projectId, oldCost: updatedProject.cost, updatedCost: payload.cost, activityBy: userId})
  return updatedProject
}

export function importExcelAndFormatData(filePath: string) {
  if (!['.xlsx', ".csv"].includes(extname(filePath))) {
    unlinkSync(filePath);
    throw new APIError(`please upload valid xlsx/csv file`)
  }
  let workBook = xlsx.readFile(filePath, {
    type: 'binary',
    cellDates: true,
    cellNF: false,
    cellText: false
  });
  xlsx.writeFile(workBook, filePath)
  unlinkSync(filePath);
  if (!workBook.SheetNames) { throw new APIError("not a valid sheet") }
  var excelFormattedData: any[] = xlsx.utils.sheet_to_json(workBook.Sheets[workBook.SheetNames[0]]);
  return excelFormattedData
}

export async function uploadTasksExcel(filePath: string, projectId: string, userToken: string, userObj: any) {
  const roleData: any = await role_list()
  const isEligible = await checkRoleScope(userObj.role, `upload-task-excel`)
  if (!isEligible) {
    throw new APIError(TASK_ERROR.UNAUTHORIZED_PERMISSION)
  }
  const roleNames = roleData.roles.map((role: any) => role.roleName)
  const excelFormattedData = importExcelAndFormatData(filePath)
  if (!excelFormattedData.length) {
    throw new APIError(`Uploaded empty document`)
  }
  const validatedTaskData = excelFormattedData.map(data => validateObject(data, roleNames))
  const tasksDataWithIds = await Promise.all(validatedTaskData.map(taskData => formatTasksWithIds(taskData, projectId, userObj)))
  for (let taskData of tasksDataWithIds) {
    await createTask(taskData, projectId, userToken, userObj)
  }
  // await Promise.all(tasksDataWithIds.map(taskData => createTask(taskData, projectId, userToken, userObj)))
  return { message: 'success' }
}

async function formatTasksWithIds(taskObj: any, projectId: string, userObj: any) {
  const [projectData, memberRoles] = await Promise.all([
    ProjectSchema.findById(projectId).exec(),
    projectMembers(projectId, userObj)
  ])
  // if ((tags && !Array.isArray(tags)) || (taskObj.approvers && !Array.isArray(taskObj.approvers)) || (taskObj.viewers && !Array.isArray(taskObj.viewers)) || (taskObj.supporters && !Array.isArray(taskObj.supporters))) {
  //   throw new APIError(TASK_ERROR.INVALID_ARRAY);
  // }
  // taskObj.approvers = Object.keys(taskObj).filter(key => key == `approvers`).map
  const approverIds = memberRoles.filter((memberRole: any) => memberRole.key.some((role: string) => taskObj.approvers.includes(role))).map((val: any) => val.value)
  const endorserIds = memberRoles.filter((memberRole: any) => memberRole.key.some((role: string) => taskObj.endorsers.includes(role))).map((val: any) => val.value)
  const viewerIds = memberRoles.filter((memberRole: any) => memberRole.key.some((role: string) => taskObj.viewers.includes(role))).map((val: any) => val.value)
  const assigneeId = memberRoles.filter((memberRole: any) => memberRole.key.some((role: string) => [taskObj.assignee].includes(role))).map((val: any) => val.value).pop()

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
  if (taskObj.pillarId) taskObj.pillarId = (await PillarSchema.findOne({ name: new RegExp(taskObj.pillarId) }).exec() as any || { _id: undefined })._id || undefined
  if (taskObj.stepId) taskObj.stepId = (await StepsSchema.findOne({ name: new RegExp(taskObj.stepId) }).exec() as any || { _id: undefined })._id || undefined

  taskObj = {
    ...taskObj,
    projectId,
    assignee: assigneeId,
    approvers: approverIds,
    endorsers: endorserIds,
    viewers: viewerIds,
    pillarId: taskObj.pillarId,
    stepId: taskObj.stepId,
    startDate: new Date(taskObj.initialStartDate || taskObj.startDate),
    dueDate: new Date(taskObj.initialDueDate || taskObj.dueDate)
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
  const approvers = Object.keys(data).filter(key => ['approver1', `approver2`, `approver3`].includes(key)).reduce((p: any, c) => p.concat([data[c].trim()]), [])
  const endorsers = Object.keys(data).filter(key => ['endorser1', `endorser2`, `endorser3`].includes(key)).reduce((p: any, c) => p.concat([data[c].trim()]), [])
  const viewers = Object.keys(data).filter(key => ['viewer1', `viewer2`, `viewer3`].includes(key)).reduce((p: any, c) => p.concat([data[c].trim()]), [])
  if (!data.assignee || !data.assignee.trim().length) {
    throw new APIError(`Assignee is required for task ${data.name}`)
  }
  // const approvers = data.approvers.split(',').map((value: string) => value.trim()).filter((v: string) => !!v)
  // const endorsers = data.endorsers.split(',').map((value: string) => value.trim()).filter((v: string) => !!v)
  // const viewers = data.endorsers.split(',').map((value: string) => value.trim()).filter((v: string) => !!v)
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

  if (data.initialStartDate && new Date().getTime() > new Date(data.initialStartDate).setHours(23, 59, 59, 0)) throw new Error("Start date must Not be in the past.")
  if (data.initialDueDate && new Date(data.initialStartDate).setHours(0, 0, 0, 0) > new Date(data.initialDueDate).setHours(23, 59, 59, 0)) throw new Error("Start date must be lessthan due date.")

  return {
    name: data.name,
    description: data.description,
    initialStartDate: data.initialStartDate,
    initialDueDate: data.initialDueDate,
    // Validate ids
    // tags: data.tags,
    assignee: data.assignee,
    viewers: viewers || data.viewers,
    approvers: approvers || data.approvers,
    endorsers: endorsers || data.endorsers,
    stepId: data.stepId || data.step,
    pillarId: data.pillarId || data.pillar,
    isFromExcel: true,
    documents: data.documents
  }
}

export async function projectCostInfo(projectId: string, projectCost: number, userRole: string, userId: string) {
  try {
    const isEligible = await checkRoleScope(userRole, 'edit-project-cost')
    if (!isEligible) {
      throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
    }
    const updatedProject = await ProjectSchema.findByIdAndUpdate(projectId, { $set: { projectCost } }).exec()
    createLog({ activityBy: userId, activityType: ACTIVITY_LOG.UPDATED_CITIIS_GRANTS, oldCost: (updatedProject as any).projectCost, updatedCost: projectCost, projectId });

    let userDetails = await userFindOne("id", userId);
    let { fullName, mobileNo } = getFullNameAndMobile(userDetails);
    sendNotification({
      id: userId, fullName, email: userDetails.email, mobileNo,
      oldCost: (updatedProject as any).projectCost, updatedCost: projectCost,
      templateName: "updateFinancial", mobileTemplateName: "updateFinancial"
    })

    return updatedProject
  }
  catch (err) {
    throw err
  }
}

export async function citiisGrantsInfo(projectId: string, citiisGrants: number, userRole: string, userId: string) {
  try {
    const isEligible = await checkRoleScope(userRole, 'edit-citiis-grants')
    if (!isEligible) {
      throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
    }
    const projectInfo: any = await ProjectSchema.findById(projectId).exec()
    if ((projectInfo as any).projectCost < citiisGrants) {
      throw new APIError(PROJECT_ROUTER.CITIIS_GRANTS_VALIDATION)
    }
    let totalFundData:any  = await getTotalReleasedFunds(projectId)
    if(totalFundData.funds.totalReleased>citiisGrants){
      throw new Error("CitiiesGrant must not be less then Released Funds")
    }
    const updatedProject = await ProjectSchema.findByIdAndUpdate(projectId, { $set: { citiisGrants } }, { new: true }).exec()
    createLog({ activityBy: userId, activityType: ACTIVITY_LOG.UPDATED_CITIIS_GRANTS, oldCost: projectInfo.citiisGrants, updatedCost: citiisGrants, projectId })

    // let userDetails = await userFindOne("id", userId);
    // let { fullName, mobileNo } = getFullNameAndMobile(userDetails);
    // sendNotification({
    //   id: userId, fullName, email: userDetails.email, mobileNo,
    //   oldCost: projectInfo.citiisGrants, updatedCost: citiisGrants,
    //   templateName: "updateFinancial", mobileTemplateName: "updateFinancial"
    // })

    return updatedProject
  }
  catch (err) {
    throw err
  }
}

export async function addOpenComment(projectId: string, user: any, payload: any) {
  const [projectDetail, isEligible]: any = await Promise.all([
    ProjectSchema.findById(projectId).exec(),
    checkRoleScope(user.role, 'add-open-comments')
  ])
  if (!isEligible) {
    throw new APIError(TASK_ERROR.UNAUTHORIZED_PERMISSION)
  }
  if (!projectDetail.members.includes(user._id) && (projectDetail.createdBy != user._id)) {
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
  if (!await OpenCommentsModel.findOne({ projectId, userId: user._id }).exec()) {
    await OpenCommentsModel.create({ ...payload, projectId, userId: user._id, isParent: true })
  }
  await OpenCommentsModel.findOneAndUpdate({ projectId, userId: user._id, isParent: true }, { $set: payload }).exec()
  // Creating copy
  await OpenCommentsModel.create({ ...payload, projectId, userId: user._id, isParent: false })
  return { message: 'Comment added successfully' }
}

export async function myCommentDetail(projectId: string, userId: string) {
  const detail = await OpenCommentsModel.findOne({ projectId, userId, isParent: true }).exec()
  return (detail || {})
}

export async function getMyOpenCommentsHistory(projectId: string, userId: string) {
  return await OpenCommentsModel.find({ projectId, userId, isParent: false }).sort({ createdAt: 1 }).exec()
}

export async function getAllOpenCOmments(user: any, projectId: string, userId: string) {
  const isEligible = await checkRoleScope(user.role, `view-open-comments`)
  if (!isEligible) {
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
  if (!userId) {
    throw new APIError(`User id is required`)
  }
  return await OpenCommentsModel.findOne({ projectId, isParent: true, userId }).exec()
  // const userIds = comments.map((comment: any) => comment.userId)
  // const usersInfo = await userFindMany('_id', userIds, { firstName: 1, lastName: 1, middleName: 1, email: 1, phone: 1, countryCode: 1, is_active: 1 })
  // return comments.map(comment => ({...comment.toJSON(), userId: usersInfo.find((userInfo: any) => userInfo._id == (comment as any).userId)}))
}

export async function getCommentedUsers(projectId: string, user: any) {
  const isEligible = await checkRoleScope(user.role, `view-open-comments`)
  if (!isEligible) {
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
  const comments = await OpenCommentsModel.find({ projectId, isParent: true }).sort({ createdAt: 1 }).exec()
  const userIds = comments.map((comment: any) => comment.userId).filter(u => u != user._id)
  return await userFindMany('_id', userIds, { firstName: 1, lastName: 1, middleName: 1, email: 1, phone: 1, countryCode: 1, is_active: 1 })
}

export async function editProjectMiscompliance(projectId: string, payload: any, userObj: any) {
  try {
    if (!Types.ObjectId.isValid(projectId)) throw new Error("Invalid Project Id.")
    const isEligible = await checkRoleScope(userObj.role, 'manage-compliance')
    if (!isEligible) {
      throw new APIError(COMPLIANCES.MISCOMPLIANCE_ERROR)
    }
    let obj: any = {};
    if ("miscomplianceSpv" in payload) obj.miscomplianceSpv = payload.miscomplianceSpv
    if ("miscomplianceProject" in payload) obj.miscomplianceProject = payload.miscomplianceProject
    await project.findByIdAndUpdate(projectId, obj);
    return { message: `successfully ${"miscomplianceProject" in payload ? "miscomplianceProject" : "miscomplianceSpv"} updated.` }
  } catch (err) {
    throw err
  };
};

export async function editTriPartiteDate(id: string, payload: any, user: any) {
  const isEligible = await checkRoleScope(user.role, `edit-tri-partite-aggrement-date`)
  if (!isEligible) {
    throw new APIError(USER_ROUTER.INVALID_ADMIN)
  }
  return await ProjectSchema.findByIdAndUpdate(id, { $set: { tripartiteAggrementDate: { modifiedBy: user._id, date: payload.tripartiteAggrementDate } } }, { new: true }).exec()
}

export async function addPhaseToProject(projectId: string, payload: any) {
  return await ProjectSchema.findByIdAndUpdate(projectId, { $set: { phases: formatAndValidatePhasePayload(payload) } }, { new: true }).exec()
}

export async function listPhasesOfProject(projectId: string) {
  const projectDetail: any = await ProjectSchema.findById(projectId).exec()
  const phaseIds = projectDetail.phases.map((phase: any) => phase.phase.toString())
  const phases = await phaseSchema.find({ _id: { $in: phaseIds } }).exec()
  return projectDetail.toJSON().phases.map((phase: any) => ({
    ...phase, phase: phases.find(_phase => _phase._id.toString() == phase.phase.toString()),
  }))
}

function formatAndValidatePhasePayload(payload: any) {
  return payload.map((_data: any, index: number) => {
    if (payload[index + 1]) {
      if (!_data.phase || !_data.startDate || !_data.endDate) {
        throw new APIError(DOCUMENT_ROUTER.MANDATORY)
      }
      if (_data.startDate > _data.endDate) {
        throw new APIError(`Phase start date should be before end date`)
      }
      if (payload[index + 1] && (!payload[index + 1].startDate || (new Date(payload[index + 1].startDate).setHours(0, 0, 0, 0) <= new Date(_data.endDate).setHours(23, 59, 59, 0)))) {
        throw new APIError(`There shouldn't be any gap/overlap between phases`)
      }
    }
    return {
      phase: _data.phase,
      startDate: new Date(new Date(_data.startDate).setHours(0, 0, 0, 0)),
      endDate: new Date(new Date(_data.endDate).setHours(23, 59, 59, 0)),
    }
  })
}

export async function addInstallments(projectId: string, payload: any, user?: any) {
  const projectDetail: any = await ProjectSchema.findById(projectId).exec()
  const isEligible = await checkRoleScope(user.role, `manage-project-released-fund`)
  if (!isEligible) {
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
  const finalPayload = payload.fundsReleased.map((fund: any, index: number) => {
    if (!fund.phase) {
      throw new APIError(`Phase is required`)
    }
    if (!fund.percentage) {
      throw new APIError(`Percentage is required`)
    }
    return { ...fund, installment: index + 1 }
  })
  const overAllPercentage = finalPayload.reduce((p: number, fund: any) => p + Number(fund.percentage), 0)
  if (overAllPercentage > 100) {
    throw new APIError(`Percentage should not exceed 100`)
  }
  const updated = await ProjectSchema.findByIdAndUpdate(projectId, { $set: { fundsReleased: finalPayload, fundsUtilised: finalPayload } }, { new: true }).exec()
  return updated
}


export async function addFunds(projectId: string, payload: any, user: any) {
  if (!payload.installment) {
    throw new APIError(`Installment is required`)
  }
  // if(!(payload.releasedCost && payload.releasedDocuments)||!(payload.utilisedCost && payload.utilisedDocuments)){
  //   throw new APIError(`All Mandatory fields are required`)
  // }
  const fund: any = await ProjectSchema.findById(projectId).exec()
  if (!fund) {
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
  const { funds, projectCost, citiisGrants } = fund
  const otherFunds = funds.filter((fund: any) => fund.installment != payload.installment)
  const matchedFunds = funds.filter((fund: any) => fund.installment == payload.installment)
  if (payload.releasedCost && payload.releasedDocuments) {
    const isEligible = await checkRoleScope(user.role, `manage-project-released-fund`)
    if (!isEligible) {
      throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
    }
    if(citiisGrants<payload.releasedCost){
        throw new Error("Released Amount should not exceed CitiisGrants")
    }
    let matchedFundsWithData = matchedFunds.length == 1 && !matchedFunds[0].releasedCost ? [] : matchedFunds
    const updates = {
      funds: otherFunds.concat(matchedFundsWithData).concat([
        {
          phase: matchedFunds[0].phase,
          percentage: matchedFunds[0].percentage,
          subInstallment: matchedFundsWithData.length + 1,
          installment: payload.installment,
          releasedDocuments: payload.releasedDocuments,
          releasedCost: payload.releasedCost,
          utilisedDocuments: matchedFunds[0].utilisedDocuments,
          utilisedCost: matchedFunds[0].utilisedCost,
          createdAt: new Date(),
          modifiedAt: new Date(),
          releasedBy: user._id,
          utilisedBy: matchedFunds[0].utilisedBy ? matchedFunds[0].utilisedBy : null
        }
      ]).sort((a: any, b: any) => a.installment - b.installment)
    }
    let fundsData = updates.funds.reduce((p: any, fund: any) => {
      const { installmentType } = getPercentageByInstallment(fund.installment)
      const releasedItems = funds.filter((_fund: any) =>
        (!_fund.deletedReleased && _fund.subInstallment && (_fund.installment == fund.installment)
        )).map((item: any) => ({ ...item.toJSON()})) 
      let difference = (Math.round(citiisGrants * (fund.percentage / 100))) - fund.releasedCost      
      p.push({
        fundsPlanned: Math.round(citiisGrants * (fund.percentage / 100)),
        difference: difference,
        cumulativeDifference: (p.cumulativeDifference || 0) + difference,
        installment: fund.installment,
        percentage: fund.percentage,
        releasedItems,
        installmentLevelTotalReleased: releasedItems.reduce((p: number, item: any) => p + (item.releasedCost || 0), 0),
      })
      return p
    }, [])
    
    if(payload.installment == (updates.funds.length)){
      let finalInstallmentFunds:any = fundsData.filter((eachfund: any) => eachfund.installment == payload.installment)
      
      if(finalInstallmentFunds.length && finalInstallmentFunds[0].cumulativeDifference< 0){
        throw new Error(`Released Amount exceeded CitiisGrants, Exceeded Amount is ${finalInstallmentFunds[0].cumulativeDifference}`)
      }
      if(finalInstallmentFunds.length && finalInstallmentFunds[0].cumulativeDifference>0){
        throw new Error(`Released Amount is less than CitiisGrants,Please add ${finalInstallmentFunds[0].cumulativeDifference} amount`)
      }
    }

    const updatedFund = await ProjectSchema.findByIdAndUpdate(projectId, { $set: updates }, { new: true }).exec()
    createLog({ activityType: ACTIVITY_LOG.ADDED_FUND_RELEASE, projectId, updatedCost: payload.releasedCost, activityBy: user._id })
    return updatedFund

  } if (payload.utilisedCost && payload.utilisedDocuments) {
    const isEligible = await checkRoleScope(user.role, `manage-project-utilized-fund`)
    if (!isEligible) {
      throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
    }
    let matchedFundsWithData = matchedFunds.length == 1 && !matchedFunds[0].utilisedCost ? [] : matchedFunds
    const updates = {
      funds: otherFunds.concat(matchedFundsWithData).concat([
        {
          phase: matchedFunds[0].phase,
          percentage: matchedFunds[0].percentage,
          subInstallment: matchedFundsWithData.length + 1,
          installment: payload.installment,
          releasedDocuments: matchedFunds[0].releasedDocuments,
          releasedCost: matchedFunds[0].releasedCost,
          utilisedDocuments: payload.utilisedDocuments,
          utilisedCost: payload.utilisedCost,
          createdAt: new Date(),
          modifiedAt: new Date(),
          utilisedBy: user._id,
          releasedBy: matchedFunds[0].releasedBy ? matchedFunds[0].releasedBy : null
        }
      ]).sort((a: any, b: any) => a.installment - b.installment)
    }
    const updatedFund = await ProjectSchema.findByIdAndUpdate(projectId, { $set: updates }, { new: true }).exec()
    createLog({ activityType: ACTIVITY_LOG.ADDED_FUND_UTILIZATION, projectId, updatedCost: payload.utilisedCost, activityBy: user._id })
    return updatedFund

  }
}

export async function getFinancialInfoNew(projectId: string, userId: string, userRole: any) {
  const [isEligible1, isEligible2, canSeeMyProject, canSeeAllProjects, canManageProject] = await Promise.all([
    checkRoleScope(userRole, `manage-project-released-fund`),
    checkRoleScope(userRole, `manage-project-utilized-fund`),
    checkRoleScope(userRole, `view-my-project`),
    checkRoleScope(userRole, `view-all-projects`),
    checkRoleScope(userRole, `manage-project`)
  ])
  if (!isEligible1 && !isEligible2 && !canSeeMyProject && !canSeeAllProjects && !canManageProject) {
    throw new APIError(PROJECT_ROUTER.FINANCIAL_INFO_NO_ACCESS)
  }
  const projectDetail = await ProjectSchema.findById(projectId).exec()
  const { fundsReleased, fundsUtilised, funds, projectCost, citiisGrants }: any = projectDetail
  const documentIds = funds.map((fund: any) => (fund.releasedDocuments || []).concat(fund.utilisedDocuments || [])).reduce((p: any, c: any) => [...p, ...c], []).filter((v: any) => (!!v && Types.ObjectId.isValid(v)))
  const documents = await documentsList(documentIds)
  let phases = await phaseSchema.find({}).exec()
  let fundsData = funds.reduce((p: any, fund: any) => {
    const { installmentType } = getPercentageByInstallment(fund.installment)
    const releasedItems = funds.filter((_fund: any) =>
      (!_fund.deletedReleased && _fund.subInstallment && (_fund.installment == fund.installment)
      )).map((item: any) => ({ ...item.toJSON(), releasedDocuments: documents.filter((d: any) => (item.releasedDocuments || []).includes(d.id)) }))
    const utilisedItems = funds.filter((_fund: any) =>
      (!_fund.deletedUtilised && _fund.subInstallment && (_fund.installment == fund.installment)
      )).map((item: any) => ({ ...item.toJSON(), utilisedDocuments: documents.filter((d: any) => (item.utilisedDocuments || []).includes(d.id)), }))

    let difference = (Math.round(citiisGrants * (fund.percentage / 100))) - fund.releasedCost
    p.push({
      fundsPlanned: Math.round(citiisGrants * (fund.percentage / 100)),
      difference: difference,
      cumulativeDifference: (p.cumulativeDifference || 0) + difference,
      phase: phases.find(phase => phase.id == fund.phase),
      installment: installmentType,
      percentage: fund.percentage,
      // Filter empty data
      releasedItems,
      utilisedItems,
      installmentLevelTotalReleased: releasedItems.reduce((p: number, item: any) => p + (item.releasedCost || 0), 0),
      installmentLevelTotalUtilised: utilisedItems.reduce((p: number, item: any) => p + (item.utilisedCost || 0), 0)
    })
    return p
  }, [])
  let ins: any = []
  fundsData = fundsData.filter((f: any) => {
    if (!ins.includes(f.installment)) {
      ins.push(f.installment)
      return f
    }
  })
  return {
    isMember: (projectDetail as any).members.includes(userId) || ((projectDetail as any).createdBy == userId),
    projectCost: projectCost,
    citiisGrants: citiisGrants,
    funds: {
      info: fundsData,
      totalReleased: fundsData.reduce((p: number, c: any) => p + c.installmentLevelTotalReleased, 0),
      totalUtilised: fundsData.reduce((p: number, c: any) => p + c.installmentLevelTotalUtilised, 0)
    }
  }
}

export async function updateReleasedFundNew(projectId: string, payload: any, user: any) {
  const isEligible = await checkRoleScope(user.role, `manage-project-released-fund`)
  if (!isEligible) {
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
  const { releasedDocuments, releasedCost, _id } = payload
  let updates: any = {}
  updates = { ...updates, modifiedAt: new Date(), releasedBy: user._id }
  updates['funds.$.releasedDocuments'] = releasedDocuments
  updates['funds.$.releasedCost'] = releasedCost
  const updatedProject: any = await ProjectSchema.findOneAndUpdate({ _id: projectId, 'funds._id': _id }, { $set: updates }).exec()
  createLog({ activityType: ACTIVITY_LOG.UPDATED_FUND_RELEASE, oldCost: updatedProject.cost, updatedCost: payload.releasedCost, projectId, activityBy: user._id })
  return updatedProject
}

export async function updateUtilizedFundNew(projectId: string, payload: any, user: any) {
  const [projectDetail, isEligible]: any = await Promise.all([
    ProjectSchema.findById(projectId).exec(),
    checkRoleScope(user.role, `manage-project-utilized-fund`)
  ])
  if (!isEligible || (!projectDetail.members.includes(user._id))) {
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
  const { utilisedDocuments, utilisedCost, _id } = payload
  let updates: any = {}
  updates = { ...updates, modifiedAt: new Date(), utilisedBy: user._id }
  updates['funds.$.utilisedDocuments'] = utilisedDocuments
  updates['funds.$.utilisedCost'] = utilisedCost
  const updatedProject: any = await ProjectSchema.findOneAndUpdate({ _id: projectId, 'funds._id': _id }, { $set: updates }).exec()
  createLog({ activityType: ACTIVITY_LOG.UPDATED_FUND_UTILIZATION, projectId, oldCost: updatedProject.utilisedCost, updatedCost: payload.cost, activityBy: user._id })
  return updatedProject
}

export async function deleteReleasedFundNew(projectId: string, payload: any, user: any) {
  const isEligible = await checkRoleScope(user.role, `manage-project-released-fund`)
  if (!isEligible) {
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
  const { releasedDocuments, releasedCost, _id } = payload
  let updates: any = {}
  updates = { ...updates, modifiedAt: new Date(), releasedBy: user._id }
  updates['funds.$.deletedReleased'] = true
  const updatedProject: any = await ProjectSchema.findOneAndUpdate({ _id: projectId, 'funds._id': _id }, { $set: updates }).exec()
  // createLog({activityType: ACTIVITY_LOG.UPDATED_FUND_RELEASE, oldCost: updatedProject.cost, updatedCost: payload.cost, projectId, activityBy: userId})
  return updatedProject
}

export async function deleteUtilizedFundNew(projectId: string, payload: any, user: any) {
  const [projectDetail, isEligible]: any = await Promise.all([
    ProjectSchema.findById(projectId).exec(),
    checkRoleScope(user.role, `manage-project-utilized-fund`)
  ])
  if (!isEligible || (!projectDetail.members.includes(user._id))) {
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
  const { utilisedDocuments, utilisedCost, _id } = payload
  let updates: any = {}
  updates = { ...updates, modifiedAt: new Date(), utilisedBy: user._id }
  updates['funds.$.deletedUtilised'] = true
  const updatedProject: any = await ProjectSchema.findOneAndUpdate({ _id: projectId, 'funds._id': _id }, { $set: updates }).exec()
  // createLog({activityType: ACTIVITY_LOG.UPDATED_FUND_UTILIZATION, projectId, oldCost: updatedProject.cost, updatedCost: payload.cost, activityBy: userId})
  return updatedProject
}

export async function addInstallmentsNew(projectId: string, payload: any, user?: any) {
  const projectDetail: any = await ProjectSchema.findById(projectId).exec()

  const isEligible = await checkRoleScope(user.role, `manage-project-released-fund`)
  if (!isEligible) {
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
  const finalPayload = payload.funds.map((fund: any, index: number) => {
    if (!fund.phase) {
      throw new APIError(`Phase is required`)
    }
    if (!fund.percentage) {
      throw new APIError(`Percentage is required`)
    }
    return { ...fund, installment: index + 1 }
  })
  const overAllPercentage = finalPayload.reduce((p: number, fund: any) => p + Number(fund.percentage), 0)
  if (overAllPercentage != 100) {
    throw new APIError(`Overall Percentage should be 100`)
  }
  const updated = await ProjectSchema.findByIdAndUpdate(projectId, { $set: { funds: finalPayload } }, { new: true }).exec()
  return updated
}

export async function getTotalReleasedFunds(projectId: string) {
  const projectDetail = await ProjectSchema.findById(projectId).exec()
  const { fundsReleased, fundsUtilised, funds, projectCost, citiisGrants }: any = projectDetail
  const documentIds = funds.map((fund: any) => (fund.releasedDocuments || []).concat(fund.utilisedDocuments || [])).reduce((p: any, c: any) => [...p, ...c], []).filter((v: any) => (!!v && Types.ObjectId.isValid(v)))
  const documents = await documentsList(documentIds)
  let phases = await phaseSchema.find({}).exec()
  let fundsData = funds.reduce((p: any, fund: any) => {
    const { installmentType } = getPercentageByInstallment(fund.installment)
    const releasedItems = funds.filter((_fund: any) =>
      (!_fund.deletedReleased && _fund.subInstallment && (_fund.installment == fund.installment)
      )).map((item: any) => ({ ...item.toJSON(), releasedDocuments: documents.filter((d: any) => (item.releasedDocuments || []).includes(d.id)) }))
    const utilisedItems = funds.filter((_fund: any) =>
      (!_fund.deletedUtilised && _fund.subInstallment && (_fund.installment == fund.installment)
      )).map((item: any) => ({ ...item.toJSON(), utilisedDocuments: documents.filter((d: any) => (item.utilisedDocuments || []).includes(d.id)), }))

    let difference = (Math.round(citiisGrants * (fund.percentage / 100))) - fund.releasedCost
    p.push({
      fundsPlanned: Math.round(citiisGrants * (fund.percentage / 100)),
      difference: difference,
      cumulativeDifference: (p.cumulativeDifference || 0) + difference,
      phase: phases.find(phase => phase.id == fund.phase),
      installment: installmentType,
      percentage: fund.percentage,
      // Filter empty data
      releasedItems,
      utilisedItems,
      installmentLevelTotalReleased: releasedItems.reduce((p: number, item: any) => p + (item.releasedCost || 0), 0),
      installmentLevelTotalUtilised: utilisedItems.reduce((p: number, item: any) => p + (item.utilisedCost || 0), 0)
    })
    return p
  }, [])
  let ins: any = []
  fundsData = fundsData.filter((f: any) => {
    if (!ins.includes(f.installment)) {
      ins.push(f.installment)
      return f
    }
  })
  return {
    projectCost: projectCost,
    citiisGrants: citiisGrants,
    funds: {
      info: fundsData,
      totalReleased: fundsData.reduce((p: number, c: any) => p + c.installmentLevelTotalReleased, 0),
      totalUtilised: fundsData.reduce((p: number, c: any) => p + c.installmentLevelTotalUtilised, 0)
    }
  }
}