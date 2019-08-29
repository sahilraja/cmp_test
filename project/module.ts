import { MISSING } from "../utils/error_msg";
import { project } from "./project_model";
import { Types } from "mongoose";
import { tags } from "./tag_model";
import { themes } from "./theme_model";
import { checkCapability } from "../utils/utils";
import { userRoleAndScope } from "../role/module";

//  Add city Code
export async function create_city_code(reqObject: any, user: any) {
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

    let success = await project.create({
      reference: reqObject.citycode,
      city: reqObject.cityname,
      summary: reqObject.description || "N/A"
    });
    return { status: true, data: success };
  } catch (err) {
    console.log(err);
    throw err;
  }
}

//  Edit city Code
export async function edit_city_code(id: any, reqObject: any, user: any) {
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
    let success = await project.findByIdAndUpdate(id, obj, { new: true });
    return { status: true, data: success };
  } catch (err) {
    console.log(err);
    throw err;
  }
}

//  Get List of city Codes
export async function city_code_list() {
  try {
    let success = await project.find(
      { is_active: true },
      { reference: 1, city: 1 }
    );
    return { status: true, data: success };
  } catch (err) {
    console.log(err);
    throw err;
  }
}

//  edit status of city code
export async function city_code_status(id: any) {
  try {
    if (!id) throw new Error(MISSING);
    let projectData: any = await project.findById(id);
    if (!projectData) {
      throw new Error("project not there");
    }
    let success = await project.findByIdAndUpdate(
      { id },
      { is_active: projectData.is_active ? false : true }
    );
    return { status: true, data: success };
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
    let data = await tags.create({
      tag: reqObject.tag,
      description: reqObject.description || "N/A"
    });
    return { status: true, data: data };
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
    let data = await tags.findByIdAndUpdate(id, obj, { new: true });
    return { status: true, data: data };
  } catch (err) {
    console.log(err);
    throw err;
  }
}

//  get list of tags
export async function tag_list() {
  try {
    let data = await tags.find({ is_active: true });
    return { status: true, data: data };
  } catch (err) {
    console.log(err);
    throw err;
  }
}

//  edit status of tag
export async function tag_status(id: any) {
  try {
    let city = await tags.findById(id);
    if (!city) {
      throw new Error(MISSING);
    }
    let data = await tags.findByIdAndUpdate(
      { id },
      { is_active: city.is_active == true ? false : true }
    );
    return { status: true, data: data };
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
    let data = await themes.create({
      city_code: reqObject.theme,
      description: reqObject.description || "N/A"
    });
    return { status: true, data: data };
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
      obj.tag = reqObject.theme;
    }
    if (reqObject.description) {
      obj.description = reqObject.description;
    }
    let data = await themes.findByIdAndUpdate(id, obj, { new: true });
    return { status: true, data: data };
  } catch (err) {
    console.log(err);
    throw err;
  }
}

//  get list of theme
export async function theme_list() {
  try {
    let data = await themes.find({ is_active: true });
    return { status: true, data: data };
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
    let data = await themes.findByIdAndUpdate(
      { id },
      { is_active: city.is_active == true ? false : true }
    );
    return { status: true, data: data };
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
    if (userProjects.data[0].scope == "global") {
      list = await project.find({ is_active: true });
    } else {
      list = await project.find({
        id: { $in: userProjects.data[0].scope },
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
export async function getProjectDetail(projectId:string){
   try {
       return await project.findById(projectId)
   } catch (error) {
       console.log(error)
       throw error
   }
}
