import * as fs from "fs";
import { join } from "path";
import * as request from "request-promise";
import { hashPassword } from "./utils";
import { addRole } from "./rbac";
import { RBAC_URL } from "./urls";
import { userList, createUser } from "./users";

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
      "is_active":true
    })
    let grants = await addRole(user._id, "technology-lead")
    console.log("No existing users found. Technology specialist user created successfully");
  }
  else {
    console.log(`${existingUserCount.length} existing users found in DB`);
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
      for (const policy of data.data) {
          if (policy[0].includes(role) && policy[2].includes(capabilities) || role == 'technology-lead') {
              return true
          }
      }
      return false
  } catch (err) {
      console.log(err);
      throw err
  }
}


