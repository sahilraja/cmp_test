import { MISSING, PROJECT_ROUTER } from "../utils/error_msg";
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
import { getUserDetail } from "../users/module";
import { userFindMany } from "../utils/users";
import { APIError } from "../utils/custom-error";

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

    return await ProjectSchema.create({
      createdBy: user._id,
      name: reqObject.name,
      reference: reqObject.reference,
      city: reqObject.cityname,
      summary: reqObject.description || "N/A",
      maturationStartDate: { date: reqObject.maturationStartDate, modifiedBy: user._id },
      maturationEndDate: { date: reqObject.maturationEndDate, modifiedBy: user._id },
    });
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
    return await ProjectSchema.findByIdAndUpdate(id, { $set: obj }, { new: true }).exec();
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export async function manageProjectMembers(id: string, members: string[], loggedUserId: string) {
  members = Array.from(new Set(members))
  if (members.includes(loggedUserId)) {
    throw new APIError(`You are trying to add yourself as project member`)
  }
  return await ProjectSchema.findByIdAndUpdate(id, { $set: { members } }, { new: true }).exec()
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
    const { docs: list, page, pages } = await ProjectSchema.paginate({ $or: [{ createdBy: userId }, { members: { $in: [userId] } }] })
    const projectIds = (list || []).map((_list) => _list.id)
    return { docs: await mapProgressPercentageForProjects(projectIds, userToken, list), page, pages }
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
  return await httpRequest(options)
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
  return await httpRequest(options)
}

export async function linkTask(projectId: string, taskId: string, userToken: string) {
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
  return await httpRequest(options)
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

export async function getFinancialInfo(projectId: string) {
  const projectDetail = await ProjectSchema.findById(projectId).exec()
  const { fundsReleased, fundsUtilised }:any = projectDetail
  return { fundsReleased, fundsUtilised }
}

export async function addFundReleased(projectId: string, payload: any, userId: string) {
  if(!payload.installment){
    throw new APIError(`Installment is required`)
  }
  const fund: any = await ProjectSchema.findById(projectId).exec()
  const { fundsReleased } = fund
  const otherFunds = fundsReleased.filter((fund: any) => fund.installment != payload.installment)
  const matchedFunds = fundsReleased.filter((fund: any) => fund.installment == payload.installment)
  const updates = {fundsReleased: otherFunds.concat(matchedFunds).concat([
    {
      subInstallment:matchedFunds.length + 1,
      installment: payload.installment, document: payload.document, cost: payload.cost, 
      createdAt: new Date(), modifiedAt: new Date(), modifiedBy: userId
    }
  ]).sort((a: any, b: any) => a.installment - b.installment)}
  return await ProjectSchema.findByIdAndUpdate(projectId, { $set: updates }, {new: true}).exec()
}

export async function addFundsUtilized(projectId: string, payload: any, userId: string) {
  if(!payload.installment){
    throw new Error(`Installment is required`)
  }
  const project: any = await ProjectSchema.findById(projectId).exec()
  const { fundsUtilised } = project
  const otherFunds = fundsUtilised.filter((fund: any) => fund.installment != payload.installment)
  const matchedFunds = fundsUtilised.filter((fund: any) => fund.installment == payload.installment)
  const updates = {fundsUtilised: otherFunds.concat(matchedFunds).concat([
    {
      subInstallment: matchedFunds.length + 1,
      installment: payload.installment, document: payload.document, cost: payload.cost, 
      createdAt: new Date(), modifiedAt: new Date(), modifiedBy: userId
    }
  ]).sort((a: any, b: any) => a.installment - b.installment)}
  return await ProjectSchema.findByIdAndUpdate(projectId, { $set: updates }, {new: true}).exec()
}

export async function updateReleasedFund(projectId: string, payload: any, userId: string) {
  const {document, cost, _id} = payload
  let updates:any = {}
  updates = {...updates, modifiedAt: new Date(), modifiedBy: userId}
  updates['fundsReleased.$.document'] = document
  updates['fundsReleased.$.cost'] = cost
  return await ProjectSchema.findOneAndUpdate({_id:projectId, 'fundsReleased._id':_id}, {$set:updates}).exec()
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

export async function updateUtilizedFund(projectId: string, payload: any, userId: string) {
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
  const {document, cost, _id} = payload
  let updates:any = {}
  updates = {...updates, modifiedAt: new Date(), modifiedBy: userId}
  updates['fundsReleased.$.document'] = document
  updates['fundsReleased.$.cost'] = cost
  return await ProjectSchema.findOneAndUpdate({_id:projectId, 'fundsReleased._id':_id}, {$set:updates}).exec()
}
