import { MISSING } from "../utils/error_msg";
import { project as ProjectSchema } from "./project_model";
import { Types } from "mongoose";
import { tags } from "../tags/tag_model";
import { themes } from "./theme_model";
import { userRoleAndScope } from "../role/module";
import { taskModel } from "./task_model";
import { workflowModel } from "./workflow_model";
import { checkCapability } from "../utils/rbac";

//  Add city Code
export async function createProject(reqObject: any, user: any) {
  try {
    if (!reqObject.citycode || !reqObject.cityname) {
      throw new Error(MISSING);
    }
    //  check capability
    let capability = await checkCapability({
      role: user.role,
      scope: "global",
      capability: "create-project"
    });
    if (!capability.status) throw new Error("Invalid User");

    return await ProjectSchema.create({
      reference: reqObject.citycode,
      city: reqObject.cityname,
      summary: reqObject.description || "N/A",
      maturationStartDate: { date: reqObject.maturationStartDate, modifiedBy: user._id },
      maturationEndDate: { date: reqObject.maturationEndDate, modifiedBy: user._id },
    });
  } catch (err) {
    console.log(err);
    throw err;
  }
}

//  Edit city Code
export async function editProject(id: any, reqObject: any, user: any) {
  try {
    if (!id || !user) throw new Error(MISSING);
    let obj: any = {};

    //  check capability
    let capability = await checkCapability({
      role: user.role,
      scope: "global",
      capability: "create-project"
    });
    if (!capability.status) throw new Error("Invalid User");

    if (reqObject.citycode) {
      obj.reference = reqObject.citycode;
    }
    if (reqObject.cityname) {
      obj.city = reqObject.cityname;
    }
    if (reqObject.description) {
      obj.summary = reqObject.description;
    }
    if(reqObject.maturationStartDate){
      obj.maturationStartDate = { date: reqObject.maturationStartDate, modifiedBy: user._id }
    }
    return await ProjectSchema.findByIdAndUpdate(id, { $set:obj }, { new: true }).exec();
  } catch (err) {
    console.log(err);
    throw err;
  }
}

export async function manageProjectMembers(id: string, members:string[]) {
  return await ProjectSchema.findByIdAndUpdate(id, { $set: { members } }, { new: true }).exec()
}

//  Get List of city Codes
export async function projectList() {
  try {
    return await ProjectSchema.find({ is_active: true }).exec();
  } catch (err) {
    console.log(err);
    throw err;
  }
}

//  edit status of city code
export async function city_code_status(id: any) {
  try {
    if (!id) throw new Error(MISSING);
    let projectData: any = await ProjectSchema.findById(id).exec();
    if (!projectData) {
      throw new Error("project not there");
    }
    return await ProjectSchema.findByIdAndUpdate(
      { id },
      { is_active: projectData.is_active ? false : true },{new: true}
    ).exec();
  } catch (err) {
    console.log(err);
    throw err;
  }
}

//  add tag
export async function add_tag(reqObject: any) {
  try {
    if (!reqObject.tag) {
      throw new Error(MISSING);
    }
    return await tags.create({
      tag: reqObject.tag,
      description: reqObject.description || "N/A"
    });
  } catch (err) {
    console.log(err);
    throw err;
  }
}

//  edit tag
export async function edit_tag(id: any, reqObject: any) {
  try {
    let obj: any = {};
    if (reqObject.tag) {
      obj.tag = reqObject.tag;
    }
    if (reqObject.description) {
      obj.description = reqObject.description;
    }
    return await tags.findByIdAndUpdate(id, obj, { new: true });
  } catch (err) {
    console.log(err);
    throw err;
  }
}



export async function getTagByIds(ids:string[]) {
  return await tags.find({_id:{$in:ids}}).exec()
}

//  edit status of tag
export async function tag_status(id: any) {
  try {
    let city: any = await tags.findById(id);
    if (!city) {
      throw new Error(MISSING);
    }
    return await tags.findByIdAndUpdate(
      { id },
      { is_active: city.is_active == true ? false : true }
    );
  } catch (err) {
    console.log(err);
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
    console.log(err);
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
    console.log(err);
    throw err;
  }
}

//  get list of theme
export async function theme_list() {
  try {
    return await themes.find({ is_active: true });
  } catch (err) {
    console.log(err);
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
    console.log(err);
    throw err;
  }
}

//get projects list
export async function getProjectsList(userId: any) {
  try {
    let userProjects: any = await userRoleAndScope(userId);
    if (!userProjects) throw new Error("user have no projects");
    let list;
    if (userProjects.data.global) {
      list = await ProjectSchema.find({ is_active: true });
    } else {
      list = await ProjectSchema.find({
        _id: { $in: userProjects.data[0].scope },
        is_active: true
      });
    }
    return list
  } catch (error) {
    console.log(error);
    throw error;
  }
}

// get project details
export async function getProjectDetail(projectId: string) {
  try {
    return await ProjectSchema.findById(projectId).exec()
  } catch (error) {
    console.log(error)
    throw error
  };
};

//  add task
export async function createTask(objBody: any, projectId: string) {
  try {
    const { name, startDate, endDate, access } = objBody
    if (!name || !startDate || !endDate || !access) throw new Error(MISSING)
    let taskCreate = await taskModel.create({
      name: name,
      startDate: startDate,
      endDate: endDate,
      projectId: projectId

    })
    let userIds = await Promise.all(access.map(async (obj: any) => {
      let data = await workflowModel.create({
        type: obj.type,
        role: obj.role,
        user: obj.user,
        status: "PENDING",
        taskId: taskCreate.id
      })
      return data.id
    }))
    let task = await taskModel.findByIdAndUpdate(taskCreate.id, { access: userIds })
    return task
  } catch (err) {
    console.log(err)
    throw err
  };
};

export async function taskList(projectId: any) {
  try {
    let taskList = await taskModel.find({ projectId: projectId, is_active: true })
    for (const task of taskList) {
      let workflow = await workflowModel.find({ _id: { $in: task.access } })
      task.access = workflow
    }
    return taskList
  } catch (err) {
    console.log(err)
    throw err
  }
}