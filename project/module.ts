import { MISSING, PROJECT_ROUTER, ACTIVITY_LOG, TASK_ERROR, USER_ROUTER, COMPLIANCES, DOCUMENT_ROUTER, UNAUTHORIZED_ACTION, TAG_NAME_ERROR } from "../utils/error_msg";
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
import { userFindMany, userFindOne, userList } from "../utils/users";
import { APIError } from "../utils/custom-error";
import { updateProjectTasks } from "../utils/utils"
import { create as createLog } from "../log/module";
import { documentsList, updateUserInDOcs,getProjectNamesForES } from "../documents/module";
import { unlinkSync, readFileSync, writeFileSync } from "fs";
import { extname, join } from "path";
import * as xlsx from "xlsx";
import { userRolesNotification } from "../notifications/module";
import { nodemail } from "../utils/email";
import { getTemplateBySubstitutions } from "../email-templates/module";
import { OpenCommentsModel } from "./open-comments-model";
import { phaseSchema } from "../phase/model";
import { some } from "bluebird";
import { PillarSchema } from "../pillars/model";
import { StepsSchema } from "../steps/model";
import { UNAUTHORIZED } from "http-status-codes";
import { createCompliance } from "./compliances/module";
import { create as webNotification } from "../socket-notifications/module"
import { PROJECT_NOTIFICATIONS } from "../utils/web-notification-messages";
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
      throw new APIError(UNAUTHORIZED, 403);
    }
    // if (reqObject.name && (!/.*[A-Za-z0-9]{1}.*$/.test(reqObject.name))) throw new Error("you have entered invalid name. please try again.")
    const createdProject = await ProjectSchema.create({
      createdBy: user._id,
      name: reqObject.name,
      startDate: reqObject.startDate,
      endDate: reqObject.endDate,
      reference: reqObject.reference,
      state:reqObject.state,
      city: reqObject.city,
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

export async function projectInfo() {
  const projects = await ProjectSchema.find({}).exec()
  let response = projects.reduce((p, c: any) => 
  ({...p, 
    projectCost: p.projectCost + (c.projectCost || 0),
    citiisGrants:p.citiisGrants + (c.citiisGrants || 0),
    released: p.released + c.funds.reduce((p1: any, c1: any) => p1 + ((c1.released || {}).amount || 0) ,0),
    utilized: p.utilized + c.funds.reduce((p1: any, c1: any) => p1 + ((c1.utilized || {}).amount || 0) ,0)
  }),{projectCost:0, citiisGrants:0, released:0, utilized:0})
  return {...response, 
    costPercentage: Math.round((isNaN(response.citiisGrants/response.projectCost) ? 0 : (response.citiisGrants/response.projectCost))*100),
    releasedPercentage: Math.round((isNaN(response.utilized/response.released) ? 0 : (response.utilized/response.released))*100),
  }
}
//  Edit city Code
export async function editProject(id: any, reqObject: any, user: any,token:string) {
  try {
    if (!id || !user) throw new Error(MISSING);
    let obj: any = {};
    let modifiedFields = []
    let [preProjectRecord, isEligible]: any = await Promise.all([
      project.findById(id).exec(),
      checkRoleScope(user.role, "manage-project")
    ])
    // let isEligible = await checkRoleScope(user.role, "manage-project");
    if (!isEligible) throw new APIError(UNAUTHORIZED, 403);

    if (reqObject.startDate || reqObject.endDate) {
      if (new Date(reqObject.startDate) > new Date(reqObject.endDate)) throw new Error(PROJECT_ROUTER.START_DATE_LESS_THAN)
      obj.startDate = reqObject.startDate
      obj.endDate = reqObject.endDate
    };
    if (reqObject.reference) {
      if (preProjectRecord.name != reqObject.name) modifiedFields.push("Reference Id")
      obj.reference = reqObject.reference;
    }
    if (reqObject.name) {
      // if (reqObject.name && (!/.*[A-Za-z0-9]{1}.*$/.test(reqObject.name))) throw new Error("you have entered invalid name. please try again.")
      if (preProjectRecord.name != reqObject.name) modifiedFields.push("Name")
      obj.name = reqObject.name;
    }
    if (reqObject.city) {
      obj.city = reqObject.city;
    }
    if(reqObject.state){
      obj.state = reqObject.state
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
    let phases= await listPhasesOfProject(id);
    let updateTasksInElasticSearch = updateProjectTasks({projectId:id,phases},token);
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
    if (!objBody || !objBody.oldUser || !objBody.newUser || !projectId) throw new Error(PROJECT_ROUTER.MANDATORY)
    const ProjectData: any = await ProjectSchema.findById(projectId).exec()
    // if (!ProjectData.members.includes(objBody.newUser)) throw new Error("member is not a project member.")
    let success: any = await replaceProjectTaskUser(projectId, objBody.oldUser, objBody.newUser, token)
    if (success && !success.success) throw new Error(success)
    let members = [... new Set((ProjectData.members.filter((id: any) => id != objBody.oldUser)).concat([objBody.newUser]))]
    const updatedProject: any = await ProjectSchema.findByIdAndUpdate(projectId, { $set: { members } }, { new: true }).exec()
    return { message: "User replaced successfully." }
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
  // if (members.includes(userId) && !previousProjectData.members.includes(userId)) {
  //   throw new APIError(PROJECT_ROUTER.USER_ADD_PROJECT_MEMBER)
  // }
  const updatedProject: any = await ProjectSchema.findByIdAndUpdate(id, { $set: { members } }, { new: true }).exec()
  const removedUserIds = previousProjectData.members.filter((member: string) => !updatedProject.members.includes(member))
  const addedUserIds = updatedProject.members.filter((member: string) => !previousProjectData.members.includes(member))
  createLog({ activityType: ACTIVITY_LOG.PROJECT_MEMBERS_UPDATED, activityBy: userId, projectId: id, addedUserIds, removedUserIds })
  const usersData = await userFindMany(`_id`, addedUserIds, {firstName:1, lastName:1, middleName:1, phone:1, countryCode:1, email:1})
  sendAddedToProjectNotification(usersData, updatedProject.name, userId)
  return updatedProject
}

async function sendAddedToProjectNotification(users: any[], projectName: string, userId: string){
  return Promise.all(users.map((user: any) => {
    let { fullName, mobileNo } = getFullNameAndMobile(user);
    return Promise.all([
      sendNotification({
        id: user._id, mobileNo, email: user.email, fullName,
        projectName, templateName: "addedToProject", mobileTemplateName: "addedToProject"
      }),
      webNotification({ notificationType: `PROJECT`, userId: user._id, title: PROJECT_NOTIFICATIONS.MEMBER_ADDED_TO_PROJECT(projectName), from: userId })
    ])
  }))
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
    if (!isEligible) throw new APIError(UNAUTHORIZED_ACTION, 403);
    let projectData: any = await ProjectSchema.findById(id).exec();
    if (!projectData) {
      throw new Error(PROJECT_ROUTER.PROJECTS_NOT_THERE);
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

    if (!/[A-Za-z0-9 ]$/.test(reqObject.tag)) {
      throw new Error(TAG_NAME_ERROR)
    }
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
    let { docs: list, page, pages } = await ProjectSchema.paginate(query, { page: Number(currentPage), limit: Number(limit), sort: { createdAt: -1 } })
    const projectIds = (list || []).map((_list) => _list.id);
    list = await Promise.all(list.map((proObj) => mapPhases(proObj)))
    return { docs: await mapProgressPercentageForProjects(projectIds, userToken, list), page, pages };
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function mapPhases(projectObj: any) {
  return { ...projectObj.toJSON(), phases: await listPhasesOfProject(projectObj._id) }
}

export function getCurrentPhase(projectObj: any) {
  return (projectObj.phases && projectObj.phases.length ? projectObj.phases.find((phaseObj: any) => {
    return (new Date(phaseObj.startDate) <= new Date() && new Date(phaseObj.endDate) >= new Date())
  }) : {})
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
    const tasksForTheProject = (projectRelatedTasks as any).filter((task: any) => task.projectId == _list._id.toString() && task.status != 8)
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
    projectDetail = await mapPhases(projectDetail)
    return (await mapProgressPercentageForProjects([projectId], userToken, [projectDetail]))[0]
  } catch (error) {
    console.error(error)
    throw error
  };
};

export async function createTask(payload: any, projectId: string, userToken: string, userObj: any) {
  let isEligible = await checkRoleScope(userObj.role, "project-create-task");
  if (!isEligible) throw new APIError(UNAUTHORIZED_ACTION, 403);
  const taskPayload = await formatTaskPayload(payload, projectId)
  // if (!payload.isCompliance && (payload.assignee == userObj._id)) {
  //   throw new APIError(TASK_ERROR.CREATOR_CANT_BE_ASSIGNEE)
  // }
  if (payload.isCompliance && (!payload.approvers || !payload.approvers.length)) {
    throw new APIError(TASK_ERROR.APPROVERS_REQUIRED)
  }
  if(!payload.isCompliance && !payload.stepId){
    throw new APIError(TASK_ERROR.STEP_IS_REQUIRED)
  }
  if(!payload.isCompliance && !payload.pillarId){
    throw new APIError(TASK_ERROR.PILLAR_IS_REQUIRED)
  }
  let phases: any= await listPhasesOfProject(projectId);
  const options = {
    url: `${TASKS_URL}/task/create`,
    body: { ...taskPayload, defaultTags: payload.isCompliance ? ['Compliance'] : [],phases:phases },
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` },
    json: true
  }
  
  const createdTask: any = await httpRequest(options)
  createLog({ activityType: ACTIVITY_LOG.CREATE_TASK_FROM_PROJECT, taskId: createdTask._id, projectId, activityBy: userObj._id })
  if(payload.documents && payload.documents.length){
    getProjectNamesForES(payload.documents,userToken)
  }
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
  if (!isEligible) throw new APIError(UNAUTHORIZED_ACTION, 403);
  const projectDetail: any = await ProjectSchema.findById(projectId).exec()
  if (!projectDetail) {
    throw new Error(PROJECT_ROUTER.PROJECT_NOT_EXISTS)
  }
  if (!((projectDetail as any).members || []).includes(userObj._id)) {
    throw new Error(PROJECT_ROUTER.NOT_MEMBER_OF_PROJECT)
  }
  let documents: any[]
  if(payload.documents && payload.documents.length){
    const options = {
      url: `${TASKS_URL}/task/${taskId}/detail?isFromProject=${true}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${userToken}` },
      json: true
    }
    let taskDetails:any = await httpRequest(options)
    let document = taskDetails.documents
    document = [...document, ...payload.documents]
    documents = Array.from(new Set(document))
  }
  const options = {
    url: `${TASKS_URL}/task/${taskId}/soft-edit?projectId=${projectId}`,
    body: payload,
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` },
    json: true
  }
  const updatedTask = await httpRequest(options)
   if(payload.documents && payload.documents.length){
    getProjectNamesForES(payload.documents,userToken)
   }
  // createLog({ activityBy: userObj._id, activityType: ACTIVITY_LOG.TASK_DATES_UPDATED, taskId, projectId })
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
      throw new APIError(PROJECT_ROUTER.PHASE_REQUIRED)
    }
    if (!fund.percentage) {
      throw new APIError(PROJECT_ROUTER.PERCENTAGE_REQUIRED)
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
    throw new APIError(PROJECT_ROUTER.PERCENTAGE_NOT_EXCEED)
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
      throw new APIError(PROJECT_ROUTER.PHASE_REQUIRED)
    }
    if (!fund.percentage) {
      throw new APIError(PROJECT_ROUTER.PERCENTAGE_REQUIRED)
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
    throw new APIError(PROJECT_ROUTER.PERCENTAGE_NOT_EXCEED)
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
        released: s.released,
        utilized: s.utilized,
        releasedCost: !(s.deletedReleased) ? s.releasedCost : null,
        utilisedCost: !(s.deletedUtilised) ? s.utilisedCost : null,
        releasedDocuments: !(s.deletedReleased) ? s.releasedDocuments : null,
        utilisedDocuments: !(s.deletedUtilised) ? s.utilisedDocuments : null,
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
  return { ...(projectDetail as any).toJSON(), tasks: (tasks as any[]).filter((task: any) => task.status != 8).map(task => ({...task, subTasks: task.subTasks.filter((t: any) => t.status != 8)})) }
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
    throw new APIError(PROJECT_ROUTER.INSTALLMENT_REQUIRED)
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
  // createLog({ activityType: ACTIVITY_LOG.ADDED_FUND_RELEASE, projectId, updatedCost: payload.cost, activityBy: user._id })
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
    throw new Error(PROJECT_ROUTER.INSTALLMENT_REQUIRED)
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
  // createLog({ activityType: ACTIVITY_LOG.UPDATED_FUND_RELEASE, oldCost: updatedProject.cost, updatedCost: payload.cost, projectId, activityBy: user._id })
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
    throw new APIError(PROJECT_ROUTER.UPLOAD_VALID_FORMAT)
  }
  let workBook = xlsx.readFile(filePath, {
    type: 'binary',
    cellDates: true,
    cellNF: false,
    cellText: false
  });
  xlsx.writeFile(workBook, filePath)
  unlinkSync(filePath);
  if (!workBook.SheetNames) { throw new APIError(PROJECT_ROUTER.NOT_VALID_DOC) }
  var excelFormattedData: any[] = xlsx.utils.sheet_to_json(workBook.Sheets[workBook.SheetNames[0]]);
  return excelFormattedData
}

export async function uploadTasksExcel(filePath: string, projectId: string, userToken: string, userObj: any, isCompliance = false) {
  const roleData: any = await role_list()
  const isEligible = await checkRoleScope(userObj.role, `upload-task-excel`)
  if (!isEligible) {
    throw new APIError(TASK_ERROR.UNAUTHORIZED_PERMISSION)
  }
  const roleNames = roleData.roles.map((role: any) => role.roleName)
  const excelFormattedData = importExcelAndFormatData(filePath)
  if (!excelFormattedData.length) {
    throw new APIError(PROJECT_ROUTER.EMPTY_DOC)
  }
  const validatedTaskData = excelFormattedData.map(data => validateObject(data, roleNames, isCompliance))
  const tasksDataWithIds = await Promise.all(validatedTaskData.map(taskData => formatTasksWithIds(taskData, projectId, userObj, isCompliance)))
  const createdData = await Promise.all(tasksDataWithIds.map(taskData => createTask(taskData, projectId, userToken, userObj)))
  if(isCompliance){
    await Promise.all(createdData.map((data, i) => createCompliance({taskId: data._id, name:data.name, complianceType:excelFormattedData[i]['Compliance Type']}, projectId, userObj)))
  }
  // await Promise.all(tasksDataWithIds.map(taskData => createTask(taskData, projectId, userToken, userObj)))
  return { message: 'Tasks uploaded successfully' }
}

async function formatTasksWithIds(taskObj: any, projectId: string, userObj: any, isCompliance:boolean) {
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
  if (!taskObj.pillarId){
    throw new APIError(TASK_ERROR.PILLAR_IS_REQUIRED)
  }
  if (!taskObj.stepId){
    throw new APIError(TASK_ERROR.STEP_IS_REQUIRED)
  }
  if (taskObj.pillarId) taskObj.pillarId = (await PillarSchema.findOne({ name: taskObj.pillarId }).exec() as any || { _id: undefined })._id || undefined
  if (taskObj.stepId) taskObj.stepId = (await StepsSchema.findOne({ name: taskObj.stepId }).exec() as any || { _id: undefined })._id || undefined
  if(!taskObj.stepId){
    throw new APIError(TASK_ERROR.INVALID_STEP)
  }
  if(!taskObj.pillarId){
    throw new APIError(TASK_ERROR.INVALID_PILLAR)
  }
  taskObj = {
    ...taskObj,
    projectId,
    assignee: assigneeId,
    approvers: approverIds,
    endorsers: endorserIds,
    viewers: viewerIds,
    pillarId: taskObj.pillarId,
    isCompliance,
    stepId: taskObj.stepId,
    startDate: new Date(taskObj.initialStartDate || taskObj.startDate),
    dueDate: new Date(taskObj.initialDueDate || taskObj.dueDate)
  }
  const { assignee, approvers, endorsers } = taskObj
  // if (Array.from(new Set(taskObj.approvers || [])).length != (taskObj.approvers || []).length) {
  //   throw new APIError(TASK_ERROR.DUPLICATE_APPROVERS_FOUND)
  // }
  // if (Array.from(new Set(taskObj.endorsers || [])).length != (taskObj.endorsers || []).length) {
  //   throw new APIError(TASK_ERROR.DUPLICATE_ENDORSERS_FOUND)
  // }
  // if (assignee && ((taskObj.approvers || []).concat(taskObj.endorsers || [])).includes(assignee)) {
  //   throw new APIError(TASK_ERROR.ASSIGNEE_ERROR)
  // }
  // if ((taskObj.approvers || []).some((approver: any) => (taskObj.endorsers || []).includes(approver))) {
  //   throw new APIError(TASK_ERROR.APPROVERS_EXISTS)
  // }
  return taskObj
}

function validateObject(data: any, roleNames: any, isCompliance: boolean) {
  let errorRole
  if (!data.Name || !data.Name.trim().length) {
    throw new APIError(TASK_ERROR.TASK_NAME_REQUIRED)
  }
  const approvers = Object.keys(data).filter(key => ['Approver 1', `Approver 2`, `Approver 3`].includes(key)).reduce((p: any, c) => p.concat([data[c].trim()]), [])
  const endorsers = Object.keys(data).filter(key => ['Endorser 1', `Endorser 2`, `Endorser 3`].includes(key)).reduce((p: any, c) => p.concat([data[c].trim()]), [])
  const viewers = Object.keys(data).filter(key => ['Viewer 1', `Viewer 2`, `Viewer 3`].includes(key)).reduce((p: any, c) => p.concat([data[c].trim()]), [])
  if (!data.Assignee || !data.Assignee.trim().length) {
    throw new APIError(PROJECT_ROUTER.ASSIGNEE_REQUIRED_TASK(data.Name))
  }
  // const approvers = data.approvers.split(',').map((value: string) => value.trim()).filter((v: string) => !!v)
  // const endorsers = data.endorsers.split(',').map((value: string) => value.trim()).filter((v: string) => !!v)
  // const viewers = data.endorsers.split(',').map((value: string) => value.trim()).filter((v: string) => !!v)
  if (!roleNames.includes(data.Assignee.trim())) {
    throw new APIError(PROJECT_ROUTER.ASSIGNEE_NOT_EXIST(data.Name))
  }
  // Validate Approvers
  if (approvers.some((approver: string) => {
    errorRole = approver
    return !roleNames.includes(approver)
  })) {
    throw new APIError(PROJECT_ROUTER.APPROVER_NOT_EXIST(errorRole, data.Name))
  }
  // Validate Endorsers  
  if (endorsers.some((endorser: string) => {
    errorRole = endorser
    return !roleNames.includes(endorser)
  })) {
    throw new APIError(PROJECT_ROUTER.ENDORSER_NOT_EXIST(errorRole, data.Name))
  }
  // Validate Viewers
  if (viewers.some((viewer: string) => {
    errorRole = viewer
    return !roleNames.includes(viewer)
  })) {
    throw new APIError(PROJECT_ROUTER.VIEWER_NOT_EXIST(errorRole, data.Name))
  }

  // if (data['Start Date'] && new Date().getTime() > new Date(data['Start Date']).setHours(23, 59, 59, 0)) {
  //   throw new Error(PROJECT_ROUTER.START_DATE_NOT_IN_PAST)
  // }
  if (data['End Date'] && new Date(data['Start Date']).setHours(0, 0, 0, 0) > new Date(data['End Date']).setHours(23, 59, 59, 0)) {
    throw new Error(PROJECT_ROUTER.START_NOT_LESS_THAN_DUE)
  }
  if(isCompliance){
    if(!data['Compliance Type']){
      throw new APIError(`Compliance type required for ${data.name}`)
    }
    if(![`SPV`, `PROJECT`].includes(data['Compliance Type'])){
      throw new APIError(`Invalid compliance type found for ${data.name}`)
    }
  }

  return {
    name: data.Name,
    description: data.Description,
    initialStartDate: data['Start Date'],
    initialDueDate: data['End Date'],
    // Validate ids
    // tags: data.tags,
    assignee: data.Assignee,
    viewers,
    approvers,
    endorsers,
    stepId: data.Step,
    pillarId: data.Pillar,
    isFromExcel: true,
    documents: data.Documents
  }
}

export async function projectCostInfo(projectId: string, projectCost: number, userRole: string, userId: string) {
  try {
    const isEligible = await checkRoleScope(userRole, 'edit-project-cost')
    if (!isEligible) {
      throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
    }
    const updatedProject = await ProjectSchema.findByIdAndUpdate(projectId, { $set: { projectCost } }).exec()
    createLog({ activityBy: userId, activityType: ACTIVITY_LOG.UPDATED_PROJECT_COST, oldCost: (updatedProject as any).projectCost, updatedCost: projectCost, projectId });

    let userDetails = await userFindOne("id", userId);
    let { fullName, mobileNo } = getFullNameAndMobile(userDetails);
    // sendNotification({
    //   id: userId, fullName, email: userDetails.email, mobileNo,
    //   oldCost: (updatedProject as any).projectCost, updatedCost: projectCost,
    //   templateName: "updateFinancial", mobileTemplateName: "updateFinancial"
    // })

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
    // let totalFundData: any = await getTotalReleasedFunds(projectId)
    let totalFundData = projectInfo.funds.reduce((p: any, c:any) => p + (c.released || {}).amount ,0)
    if (totalFundData > citiisGrants) {
      throw new Error(PROJECT_ROUTER.CITIIS_NOT_LESS_RELEASED)
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
    throw new APIError(PROJECT_ROUTER.USER_ID_REQURED)
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
    if (!Types.ObjectId.isValid(projectId)) throw new Error(PROJECT_ROUTER.INVALID_PROJECT_ID)
    const isEligible = await checkRoleScope(userObj.role, 'manage-compliance')
    if (!isEligible) {
      throw new APIError(COMPLIANCES.MISCOMPLIANCE_ERROR)
    }
    let obj: any = {};
    if ("miscomplianceSpv" in payload) obj.miscomplianceSpv = payload.miscomplianceSpv
    if ("miscomplianceProject" in payload) obj.miscomplianceProject = payload.miscomplianceProject
    await project.findByIdAndUpdate(projectId, obj);
    return { message: `Saved successfully` }
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

export async function addPhaseToProject(projectId: string, payload: any,token:string) {
  let phases= await ProjectSchema.findByIdAndUpdate(projectId, { $set: { phases: formatAndValidatePhasePayload(payload) } }, { new: true }).exec()
  let phaseList= await listPhasesOfProject(projectId);
  let updateTasksInElasticSearch = updateProjectTasks({projectId:projectId,phases:phaseList},token);
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
        throw new APIError(PROJECT_ROUTER.PHASE_BEFORE_END_DATE)
      }
      if (payload[index + 1] && (!payload[index + 1].startDate || (new Date(payload[index + 1].startDate) <= new Date(_data.endDate)))) {
        throw new APIError(PROJECT_ROUTER.PHASE_OVER_LAP)
      }
      if (payload[index + 1] && Math.abs((new Date(_data.endDate).getTime() - new Date(payload[index + 1].startDate).getTime()) / 1000) > 2) {
        throw new APIError(PROJECT_ROUTER.PHASE_OVER_LAP)
      }
    }
    if(!Types.ObjectId.isValid(_data.phase)) throw new Error(PROJECT_ROUTER.SELECT_PHASE)
    return {
      phase: _data.phase,
      // startDate: new Date(_data.startDate).setHours(0, 0, 0, 0),
      // endDate: new Date(_data.endDate).setHours(23, 59, 59, 0),
      startDate: _data.startDate,
      endDate: _data.endDate,
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
      throw new APIError(PROJECT_ROUTER.PHASE_REQUIRED)
    }
    if (!fund.percentage) {
      throw new APIError(PROJECT_ROUTER.PERCENTAGE_REQUIRED)
    }
    return { ...fund, installment: index + 1 }
  })
  const overAllPercentage = finalPayload.reduce((p: number, fund: any) => p + Number(fund.percentage), 0)
  if (overAllPercentage != 100) {
    throw new APIError(PROJECT_ROUTER.PERCENTAGE_NOT_EXCEED)
  }
  const updated = await ProjectSchema.findByIdAndUpdate(projectId, { $set: { fundsReleased: finalPayload, fundsUtilised: finalPayload } }, { new: true }).exec()
  return updated
}


export async function addFunds(projectId: string, payload: any, user: any) {
  if (!payload.installment) {
    throw new APIError(PROJECT_ROUTER.INSTALLMENT_REQUIRED)
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
        throw new Error(PROJECT_ROUTER.CITIISGRANTS_NOT_EXCEED)
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
        throw new Error(PROJECT_ROUTER.CITIISGRANTS_NOT_EXCEED_AMOUNT(finalInstallmentFunds[0].cumulativeDifference))
      }
      if(finalInstallmentFunds.length && finalInstallmentFunds[0].cumulativeDifference>0){
        throw new Error(PROJECT_ROUTER.CITIISGRANTS_NOT_LESS_AMMOUNT(finalInstallmentFunds[0].cumulativeDifference))
      }
    }
  }

  // new code end here
  // Old Code starts
  // const otherFunds = funds.filter((fund: any) => fund.installment != payload.installment)
  // const matchedFunds = funds.filter((fund: any) => fund.installment == payload.installment)
  // if (payload.releasedCost && payload.releasedDocuments) {
  //   const isEligible = await checkRoleScope(user.role, `manage-project-released-fund`)
  //   if (!isEligible) {
  //     throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  //   }
  //   if(citiisGrants<payload.releasedCost){
  //       throw new Error("Released Amount should not exceed CitiisGrants")
  //   }
  //   let matchedFundsWithData = matchedFunds.length == 1 && !matchedFunds[0].releasedCost ? [] : matchedFunds
  //   const updates = {
  //     funds: otherFunds.concat(matchedFundsWithData).concat([
  //       {
  //         phase: matchedFunds[0].phase,
  //         percentage: matchedFunds[0].percentage,
  //         subInstallment: matchedFundsWithData.length + 1,
  //         installment: payload.installment,
  //         releasedDocuments: payload.releasedDocuments,
  //         releasedCost: payload.releasedCost,
  //         utilisedDocuments: matchedFunds[0].utilisedDocuments,
  //         utilisedCost: matchedFunds[0].utilisedCost,
  //         createdAt: new Date(),
  //         modifiedAt: new Date(),
  //         releasedBy: user._id,
  //         utilisedBy: matchedFunds[0].utilisedBy ? matchedFunds[0].utilisedBy : null
  //       }
  //     ]).sort((a: any, b: any) => a.installment - b.installment)
  //   }
  //   let fundsData = updates.funds.reduce((p: any, fund: any) => {
  //     const { installmentType } = getPercentageByInstallment(fund.installment)
  //     const releasedItems = funds.filter((_fund: any) =>
  //       (!_fund.deletedReleased && _fund.subInstallment && (_fund.installment == fund.installment)
  //       )).map((item: any) => ({ ...item.toJSON()})) 
  //     let difference = (Math.round(citiisGrants * (fund.percentage / 100))) - fund.releasedCost      
  //     p.push({
  //       fundsPlanned: Math.round(citiisGrants * (fund.percentage / 100)),
  //       difference: difference,
  //       cumulativeDifference: (p.cumulativeDifference || 0) + difference,
  //       installment: fund.installment,
  //       percentage: fund.percentage,
  //       releasedItems,
  //       installmentLevelTotalReleased: releasedItems.reduce((p: number, item: any) => p + (item.releasedCost || 0), 0),
  //     })
  //     return p
  //   }, [])

  //   if(payload.installment == (updates.funds.length)){
  //     let finalInstallmentFunds:any = fundsData.filter((eachfund: any) => eachfund.installment == payload.installment)

  //     if(finalInstallmentFunds.length && finalInstallmentFunds[0].cumulativeDifference< 0){
  //       throw new Error(`Released Amount exceeded CitiisGrants, Exceeded Amount is ${finalInstallmentFunds[0].cumulativeDifference}`)
  //     }
  //     if(finalInstallmentFunds.length && finalInstallmentFunds[0].cumulativeDifference>0){
  //       throw new Error(`Released Amount is less than CitiisGrants,Please add ${finalInstallmentFunds[0].cumulativeDifference} amount`)
  //     }
  //   }

  //   const updatedFund = await ProjectSchema.findByIdAndUpdate(projectId, { $set: updates }, { new: true }).exec()
  //   createLog({ activityType: ACTIVITY_LOG.ADDED_FUND_RELEASE, projectId, updatedCost: payload.releasedCost, activityBy: user._id })
  //   return updatedFund

  // } if (payload.utilisedCost && payload.utilisedDocuments) {
  //   const isEligible = await checkRoleScope(user.role, `manage-project-utilized-fund`)
  //   if (!isEligible) {
  //     throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  //   }
  //   let matchedFundsWithData = matchedFunds.length == 1 && !matchedFunds[0].utilisedCost ? [] : matchedFunds
  //   const updates = {
  //     funds: otherFunds.concat(matchedFundsWithData).concat([
  //       {
  //         phase: matchedFunds[0].phase,
  //         percentage: matchedFunds[0].percentage,
  //         subInstallment: matchedFundsWithData.length + 1,
  //         installment: payload.installment,
  //         releasedDocuments: matchedFunds[0].releasedDocuments,
  //         releasedCost: matchedFunds[0].releasedCost,
  //         utilisedDocuments: payload.utilisedDocuments,
  //         utilisedCost: payload.utilisedCost,
  //         createdAt: new Date(),
  //         modifiedAt: new Date(),
  //         utilisedBy: user._id,
  //         releasedBy: matchedFunds[0].releasedBy ? matchedFunds[0].releasedBy : null
  //       }
  //     ]).sort((a: any, b: any) => a.installment - b.installment)
  //   }
  //   const updatedFund = await ProjectSchema.findByIdAndUpdate(projectId, { $set: updates }, { new: true }).exec()
  //   createLog({ activityType: ACTIVITY_LOG.ADDED_FUND_UTILIZATION, projectId, updatedCost: payload.utilisedCost, activityBy: user._id })
  // return updatedFund

  // }
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
  let projectDetail: any = await ProjectSchema.findById(projectId).exec()
  projectDetail = projectDetail.toJSON()
  const { fundsReleased, fundsUtilised, funds, projectCost, citiisGrants }: any = projectDetail
  const documentIds = funds.reduce((p: any[], fund: any) => [...p, ...((fund.released || {}).documents || []), ...((fund.utilized || {}).documents || [])], [])
  const [documents, phases] = await Promise.all([
    documentsList(documentIds),
    phaseSchema.find({}).exec()
  ])
  // new Code Start
  let fundsData = projectDetail.funds.map((fund: any) => ({
    ...fund,
    installment: getPercentageByInstallment(fund.installment).installmentType,
    phase: phases.find(phase => phase._id.toString() == fund.phase),
    released: {
      ...fund.released,
      cumilativeDifference: Math.round(citiisGrants * (fund.percentage / 100)) - (fund.released || {}).amount || 0,
      fundsPlanned: Math.round(citiisGrants * (fund.percentage / 100)),
      documents: documents.filter((d: any) => fund.released.documents.includes(d._id.toString()))
    },
    utilized: {
      ...fund.utilized,
      fundsPlanned: Math.round(citiisGrants * (fund.percentage / 100)),
      documents: documents.filter((d: any) => fund.utilized.documents.includes(d._id.toString()))
    }
  }))
  fundsData = fundsData.map((data: any, i: number) => {
    return {...data, cumilativeDifference: fundsData.filter((d: any, index: number) => index <= i).reduce((p: number,c: any) => p + (c.cumilativeDifference || 0) ,0)}
  })
  // new code ends

  // Old code
  // let fundsData = funds.reduce((p: any, fund: any) => {
  //   const { installmentType } = getPercentageByInstallment(fund.installment)
  //   const releasedItems = funds.filter((_fund: any) =>
  //     (!_fund.deletedReleased && _fund.subInstallment && (_fund.installment == fund.installment)
  //     )).map((item: any) => ({ ...item.toJSON(), releasedDocuments: documents.filter((d: any) => (item.releasedDocuments || []).includes(d.id)) }))
  //   const utilisedItems = funds.filter((_fund: any) =>
  //     (!_fund.deletedUtilised && _fund.subInstallment && (_fund.installment == fund.installment)
  //     )).map((item: any) => ({ ...item.toJSON(), utilisedDocuments: documents.filter((d: any) => (item.utilisedDocuments || []).includes(d.id)), }))

  //   let difference = (Math.round(citiisGrants * (fund.percentage / 100))) - fund.releasedCost
  //   p.push({
  //     fundsPlanned: Math.round(citiisGrants * (fund.percentage / 100)),
  //     difference: difference,
  //     cumulativeDifference: (p.cumulativeDifference || 0) + difference,
  //     phase: phases.find(phase => phase.id == fund.phase),
  //     installment: installmentType,
  //     percentage: fund.percentage,
  //     // Filter empty data
  //     releasedItems,
  //     utilisedItems,
  //     installmentLevelTotalReleased: releasedItems.reduce((p: number, item: any) => p + (item.releasedCost || 0), 0),
  //     installmentLevelTotalUtilised: utilisedItems.reduce((p: number, item: any) => p + (item.utilisedCost || 0), 0)
  //   })
  //   return p
  // }, [])
  // let ins: any = []
  // fundsData = fundsData.filter((f: any) => {
  //   if (!ins.includes(f.installment)) {
  //     ins.push(f.installment)
  //     return f
  //   }
  // })
  return {
    isMember: (projectDetail as any).members.includes(userId) || ((projectDetail as any).createdBy == userId),
    projectCost: projectCost,
    citiisGrants: citiisGrants,
    funds: {
      info: fundsData,
      totalReleased: fundsData.reduce((p: number, c: any) => p + c.released.amount, 0),
      totalUtilized: fundsData.reduce((p: number, c: any) => p + c.utilized.amount, 0)
    }
  }
}

export async function updateReleasedFundNew(projectId: string, payload: any, user: any,token:string) {
  const [isEligible, detail]: any = await Promise.all([
    checkRoleScope(user.role, `manage-project-released-fund`),
    ProjectSchema.findById(projectId).exec()
  ])
  if (!isEligible) {
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
  let projectInfo:any = await ProjectSchema.findById(projectId).exec();
  const { funds } = projectInfo.toJSON()
  let fundsReleased:any = funds.map((fund:any)=>{
    if(fund.released._id == payload._id){
      return fund.released;
    }
  })
  fundsReleased = fundsReleased.filter(function( element:any ) {
    return element !== undefined;
 });
  let docIds = fundsReleased && fundsReleased.length? fundsReleased.map((docs:any)=>{return docs.documents?docs.documents:[]}):[]
  const existingDocs = docIds.reduce((a:any, b:any) => a.concat(b), []);
  let docsToUpdateInES:any = [...existingDocs, ...payload.documents]
  docsToUpdateInES=Array.from(new Set(docsToUpdateInES))
  const { documents: releasedDocuments, amount: releasedCost, _id } = payload
  let updates: any = {}
  const currentObj = detail.funds.find((f: any) => f.released._id.toString() == _id)
  if(currentObj.utilized && !currentObj.utilized.deleted && currentObj.utilized.amount > releasedCost){
    throw new APIError(PROJECT_ROUTER.UTILIZED_AMOUNT_EXCEED_RELEASED)
  }
  updates = { ...updates, modifiedAt: new Date(), releasedBy: user._id }
  // updates['funds.$.releasedDocuments'] = releasedDocuments
  // updates['funds.$.releasedCost'] = releasedCost
  updates['funds.$.released.documents'] = releasedDocuments
  updates['funds.$.released.amount'] = releasedCost
  updates['funds.$.released.deleted'] = false
  const previousReleasedAmount = detail.funds.map((fund: any) => fund.released).filter((fund: any) => fund._id.toString() != _id).map((fund:any) => fund.amount).reduce((p: number, c: any) => p + c, 0)
  if((previousReleasedAmount + releasedCost) > detail.citiisGrants){
    throw new APIError(PROJECT_ROUTER.TOTAL_RELEASED_EXCEED_CITIIS)
  }
  const updatedProject: any = await ProjectSchema.findOneAndUpdate({ _id: projectId, 'funds.released._id': _id }, { $set: updates }).exec()
  createLog({ activityType: (!currentObj || currentObj.released.deleted) ? ACTIVITY_LOG.ADDED_FUND_RELEASE: ACTIVITY_LOG.UPDATED_FUND_RELEASE, oldCost: currentObj.released.amount, updatedCost: payload.amount, projectId, activityBy: user._id })
  getProjectNamesForES(docsToUpdateInES,token)
  return updatedProject
}

export async function updateUtilizedFundNew(projectId: string, payload: any, user: any,token:string) {
  const [projectDetail, isEligible]: any = await Promise.all([
    ProjectSchema.findById(projectId).exec(),
    checkRoleScope(user.role, `manage-project-utilized-fund`)
  ])
  if (!isEligible || (!projectDetail.members.includes(user._id))) {
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
  
  let projectInfo:any = await ProjectSchema.findById(projectId).exec();
  const { funds } = projectInfo.toJSON()
  let fundsUtilized:any = funds.map((fund:any)=>{
    if(fund.utilized._id == payload._id){
      return fund.utilized;
    }
  })
  fundsUtilized = fundsUtilized.filter(function( element:any ) {
    return element !== undefined;
 });
  let docIds = fundsUtilized && fundsUtilized.length? fundsUtilized.map((docs:any)=>{return docs.documents?docs.documents:[]}):[]
  const existingDocs = docIds.reduce((a:any, b:any) => a.concat(b), []);
  let docsToUpdateInES:any = [...existingDocs, ...payload.documents]
  docsToUpdateInES=Array.from(new Set(docsToUpdateInES))
  const { documents, amount, _id } = payload
  let updates: any = {}
  updates = { ...updates, modifiedAt: new Date(), utilisedBy: user._id }
  updates['funds.$.utilized.documents'] = documents
  updates['funds.$.utilized.amount'] = amount
  updates['funds.$.utilized.deleted'] = false
  const currentObj = projectDetail.funds.find((f: any) => f.utilized._id.toString() == _id)
  if(currentObj.released.amount < amount){
    throw new APIError(PROJECT_ROUTER.UTILIZED_AMOUNT_EXCEED_RELEASED)

  }
  const updatedProject: any = await ProjectSchema.findOneAndUpdate({ _id: projectId, 'funds.utilized._id': _id }, { $set: updates }).exec()
  createLog({ activityType: (!currentObj || currentObj.utilized.deleted) ? ACTIVITY_LOG.ADDED_FUND_UTILIZATION: ACTIVITY_LOG.UPDATED_FUND_UTILIZATION, projectId, oldCost: currentObj.utilized.amount, updatedCost: amount, activityBy: user._id })
  getProjectNamesForES(docsToUpdateInES,token)
  return updatedProject
}

export async function deleteReleasedFundNew(projectId: string, payload: any, user: any,token:string) {
  const [isEligible, detail]: any = await Promise.all([
    checkRoleScope(user.role, `manage-project-released-fund`),
    ProjectSchema.findById(projectId).exec()
  ]) 
  if (!isEligible) {
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
 
  let projectInfo:any = await ProjectSchema.findById(projectId).exec();
  const { funds } = projectInfo.toJSON()
  let fundsReleased:any = funds.map((fund:any)=>{
    if(fund.released._id == payload._id){
      return fund.released;
    }
  })
  fundsReleased = fundsReleased.filter(function( element:any ) {
    return element !== undefined;
 });
  let docIds = fundsReleased && fundsReleased.length? fundsReleased.map((docs:any)=>{return docs.documents?docs.documents:[]}):[]
  const existingDocs = docIds.reduce((a:any, b:any) => a.concat(b), []);
  let docsToUpdateInES:any = [...existingDocs]
  docsToUpdateInES=Array.from(new Set(docsToUpdateInES))

  const { releasedDocuments, releasedCost, _id } = payload
  const currentObj = detail.funds.find((f: any) => f.released._id.toString() == _id)
  if(currentObj.utilized && !currentObj.utilized.deleted){
    throw new APIError(PROJECT_ROUTER.CANNOT_REMOVE_RELEASED_AMOUNT)
  }
  let updates: any = {}
  updates = { ...updates, modifiedAt: new Date(), releasedBy: user._id }
  updates['funds.$.released.deleted'] = true
  updates['funds.$.released.documents'] = []
  updates['funds.$.released.amount'] = 0
  const updatedProject: any = await ProjectSchema.findOneAndUpdate({ _id: projectId, 'funds.released._id': _id }, { $set: updates }).exec()
  createLog({activityType: ACTIVITY_LOG.DELETED_FUND_RELEASE, oldCost: updatedProject.cost, updatedCost: payload.cost, projectId, activityBy: user._id})
  getProjectNamesForES(docsToUpdateInES,token)
  return updatedProject
}

export async function deleteUtilizedFundNew(projectId: string, payload: any, user: any,token:string) {
  const [projectDetail, isEligible]: any = await Promise.all([
    ProjectSchema.findById(projectId).exec(),
    checkRoleScope(user.role, `manage-project-utilized-fund`)
  ])
  if (!isEligible || (!projectDetail.members.includes(user._id))) {
    throw new APIError(PROJECT_ROUTER.UNAUTHORIZED_ACCESS)
  }
 
   
  let projectInfo:any = await ProjectSchema.findById(projectId).exec();
  const { funds } = projectInfo.toJSON()
  let fundsUtilized:any = funds.map((fund:any)=>{
    if(fund.utilized._id == payload._id){
      return fund.utilized;
    }
  })
  fundsUtilized = fundsUtilized.filter(function( element:any ) {
    return element !== undefined;
 });
  let docIds = fundsUtilized && fundsUtilized.length? fundsUtilized.map((docs:any)=>{return docs.documents?docs.documents:[]}):[]
  const existingDocs = docIds.reduce((a:any, b:any) => a.concat(b), []);
  let docsToUpdateInES:any = [...existingDocs, ...payload.utilizedDocuments]
  docsToUpdateInES=Array.from(new Set(docsToUpdateInES))
  const { utilisedDocuments, utilisedCost, _id } = payload
  let updates: any = {}
  updates = { ...updates, modifiedAt: new Date(), utilisedBy: user._id }
  updates['funds.$.utilized.deleted'] = true
  updates['funds.$.utilized.documents'] = []
  updates['funds.$.utilized.amount'] = 0
  const updatedProject: any = await ProjectSchema.findOneAndUpdate({ _id: projectId, 'funds.utilized._id': _id }, { $set: updates }).exec()
  createLog({activityType: ACTIVITY_LOG.DELETED_FUND_UTILIZATION, projectId, oldCost: updatedProject.cost, updatedCost: payload.cost, activityBy: user._id})
  getProjectNamesForES(docsToUpdateInES,token)
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
      throw new APIError(PROJECT_ROUTER.PHASE_REQUIRED)
    }
    if (!fund.percentage) {
      throw new APIError(PROJECT_ROUTER.PERCENTAGE_REQUIRED)
    }
    return { ...fund, installment: index + 1,
      released: fund.released || {}, 
      utilized: fund.utilized || {} 
    }
  })
  const overAllPercentage = finalPayload.reduce((p: number, fund: any) => p + Number(fund.percentage), 0)
  if (overAllPercentage != 100) {
    throw new APIError(PROJECT_ROUTER.PERCENTAGE_NOT_EXCEED)
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

export async function getStates() {
  let cities: any = JSON.parse(readFileSync(join(__dirname, "..", "utils", "cities.json"), "utf8"));
  return Object.keys(cities).map(state => ({state:state, cities: cities[state]}))
  // writeFileSync(join(__dirname, '..', 'utils', 'cities.json'), Object.keys(cities).map(c => cities[c].sort((a: any,b: any) => a.localeCompare(b))))
  // return cities
}

export async function editProjectPhaseInES(phaseId:string,token:string){
  const projects:any = await ProjectSchema.find({'phases.phase':phaseId}).exec();
  let projectIds =  Promise.all(projects.map(async(project:any)=>{
    let phases: any= await listPhasesOfProject(project.id || project._id);
    let updateTasksInElasticSearch = updateProjectTasks({projectId:project.id || project._id,phases},token);
  }))
  return projectIds
}

export async function backGroudJobForPhase(projectIds:any){
  let projectsInfo = await Promise.all(projectIds.map(async(id:any)=>{
    let phases: any= await listPhasesOfProject(id);
    let matchedPhase = phases&&phases.length?phases.filter((phase:any)=>(
      new Date(phase.startDate) <= new Date() && new Date(phase.endDate) > new Date())
      ):null
    return{
      projectId : id,
      phase: matchedPhase && matchedPhase.length ? matchedPhase[0].phase.phaseName: null
    }
  }))
  return projectsInfo
}
