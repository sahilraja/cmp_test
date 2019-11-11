import * as fs from "fs";
import { join } from "path";
import * as request from "request-promise";
import { hashPassword } from "./utils";
import { addRole } from "./rbac";
import { RBAC_URL } from "./urls";
import { userList, createUser } from "./users";
import { constantSchema } from "../site-constants/model";
import { notificationSchema } from "../notifications/model";
import { role_list } from "../role/module";
import { TemplateSchema } from "../email-templates/model";

export async function init() {
  let removeOptions = {
      url: `${RBAC_URL}/capabilities/remove/all`,
      method: "PUT",
      json: true
  }
  let removeCapabilities: any = await request(removeOptions);
  if (!removeCapabilities.status) {
      throw "Something Went wrong while removeing the capabilities.";
  }

  // let findOptions = {
  //   url: `${RBAC_URL}/capabilities/list`,
  //   method: "GET",
  //   json: true
  // };
  // let findCapabilities: any = await request(findOptions);
  // if (!findCapabilities.status) {
  //   throw "Something Went wrong while listing the capabilities.";
  // } else if (findCapabilities.status && findCapabilities.data.length) {
  //   throw findCapabilities.data.length + " capabilities exist in users";
  //   console.log(findCapabilities.data.length);
  // } else {
    let roles: Array<any> = JSON.parse(
      fs.readFileSync(join(__dirname, "rbac.json"), "utf8")
    );
    const capabilities = roles.reduce((capabilities, role) => {
      return capabilities.concat(
        role.capabilities.map((capability: any) => {
          return { ...capability, role: role.role };
        })
      );
    }, []);
    let addOptions = {
      url: `${RBAC_URL}/capabilities/add/all`,
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: {
        capabilities
      },
      json: true
    };
    let addCapabilities: any = await request(addOptions);
    if (!addCapabilities.status) {
      throw "Something Went wrong while adding the capabilities.";
    }
    console.log("Added capabilities from rbac.json");
  }
// }

export async function userInit() {
  let existingUserCount = await userList({});
  if (!existingUserCount.length) {
    let user = await createUser({
      "emailVerified": true,
      "phoneVerified": false,
      "firstName": "pranay",
      "lastName": `bhardwaj`,
      "email": "pranay@citiis.com",
      "aboutme": "Technology lead for CITIIS Project",
      "password": "Citiis@123",
      "phone": "7989238348",
      "countryCode": "+91",
      "is_active":true
    })
    let grants = await addRole(user._id, "technology-lead")
    console.log("No existing users found. Technology specialist user created successfully");
  }
  else {
    console.log(`${existingUserCount.length} existing users found in DB`);
  }
}
export async function siteConstants() {
  let existingConstantsCount = await constantSchema.find().count().exec();
  if(!existingConstantsCount){
    await constantSchema.create({
      aboutMe:200,
      documentName: 30
    });
    console.log(`site-constants created successfully`);
  }
  else{
    console.log(`existing site-constants found in DB`);
  }
}
export async function notifications(){
  let existingNotificationsCount = await notificationSchema.find().count().exec();
  if(!existingNotificationsCount){
      let {roles}:any= await role_list();
      let templateList:any = await TemplateSchema.find({}).exec();
      // let NotificationsList :object[] = [];
      // let notificationObject :any= {
      //   role:
      // }

      let notificationsList = roles.map((user:any)=>{
        let templates: object[] = []; 
        templateList.forEach((template:any)=> {
            templates.push({
              templateName:template.templateName,
              email:false,
              mobile:false
            })
        });
        return{
          role:user.role,
          templates
        }
      })
      await notificationSchema.create(notificationsList);
      console.log(`notifications created successfully`);
    }
    else{
      console.log(`existing notifications found in DB`);
    }
}

export async function httpRequest(options: any) {
  return new Promise((resolve, reject) => {
      request({ ...options, json: true }, function (err: Error, response: any, body: any) {
          if (err) {
              return reject(err);
          }
          try {
              resolve(body || {});
          } catch (error) {
              console.log("Failed to parse JSON", options.url, body);
              reject(new Error(`Failed to fetch results`));
          }
      });
  })
}

export async function fetchRoles() {
  let Options = {
      url: `${RBAC_URL}/capabilities/policy/list`,
      method: "GET",
      json: true
  }
  return await httpRequest(Options);
}

export async function checkRoleScope(role: any, capabilities: any) {
  try {
      const data: any = await fetchRoles()
      if (!data.status) throw new Error("Error to fetch Roles")
      if(data.data.find((d:any) => d[0] == role && d[2] == capabilities)){
        return true
      }
      // for (const policy of data.data) {
      //     if ((policy[0] == role) && (policy[2] == capabilities)) {
      //         return true
      //     }
      // }
      return false
  } catch (err) {
      console.log(err);
      throw err
  }
}


