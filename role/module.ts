import * as request from "request-promise";
import { RBAC_URL } from "../utils/urls";
import * as fs from "fs";
import { join } from "path";
import { userList } from "../utils/users";
import { roleSchema } from "./model";
import { init } from '../utils/role_management';
import { APIError } from "../utils/custom-error";
import { checkRoleScope } from '../utils/role_management'
import { USER_ROUTER, ACTIVITY_LOG } from "../utils/error_msg";
import {  addRoleNotification } from "../notifications/module"
import { ActivitySchema } from "../log/model";
import { create } from "../log/module";
// Get Roles List
export async function role_list() {
    let roles = await roleSchema.find()
    if (roles.length) {
        return {
            status: true,
            roles: roles
        }
    } else {
        return { roles: [] }
    }
};

export async function roles_list() {
    let roles: Array<any> = JSON.parse(fs.readFileSync(join(__dirname, "..", "utils", "roles.json"), "utf8"));
    let listOfRoles = roles.map(role => {
        return { role: role.role, description: role.description, category: role.category }
    });
    return {
        status: true,
        roles: listOfRoles
    }
};
export async function capabilities_list() {
    let capabilities: Array<any> = JSON.parse(fs.readFileSync(join(__dirname, "..", "utils", "capabilities.json"), "utf8"));
    let listcapabilities = capabilities.map(capability => {
        return { capability: capability.capability, description: capability.description, scope: capability.scope, shortDescription: capability.shortDescription, category: capability.category }
    });
    let result = listcapabilities.reduce((response, capability) => {
        response[capability.category] = response[capability.category] || [];
        response[capability.category].push(capability);
        return response;
    }, Object.create(null));
    result = Object.keys(result).reduce((p: any, r: any) => ({
        ...p,
        [r]: result[r].sort((a: any, b: any) => (a.shortDescription as string).localeCompare((b.shortDescription as string), 'en', { sensitivity: 'base' }))
    }), {})

    // console.log(result);
    return {
        status: true,
        capabilities: result
    }
};
//  Check Role Scope
// export async function checkRoleScope(role: any, capabilities: any) {
//     try {
//         let Options = {
//             uri: `${RBAC_URL}/capabilities/policy/list`,
//             method: "GET",
//             json: true
//         }
//         let data = await request(Options);
//         if (!data.status) throw new Error("Error to fetch Roles")
//         if (data.data.some((policy: any) => policy[0] == role && policy[2] == capabilities)) {
//             return true
//         }
//         return false
//     } catch (err) {
//         console.error(err);
//         throw err
//     }
// }

export async function userRoleAndScope(userId: any) {
    try {
        let Options = {
            uri: `${RBAC_URL}/role/list/${userId}`,
            method: "GET",
            json: true
        }
        let success = await request(Options);
        if (!success.status) throw new Error(USER_ROUTER.SOMETHING_WENT_WRONG)

        // success.data.map((key: any) => {
        //     if (object[key.role]) {
        //         object[key.role].push(key.scope)
        //     } else {
        //         if (key.scope == "global") {
        //             object[key.scope] = [key.role]
        //         } else {
        //             object[key.role] = [key.scope]
        //         }
        //     }
        // });
        // return { data: object, user: userId }
        // let object: any = {}
        // success.data.map((eachRole: any) => {
        //     eachRole.map((key: any) => {
        //         if (object[key.role]) {
        //             object[key.role].push(key.scope)
        //         } else {
        //             if (key.scope == "global") {
        //                 object[key.scope] = [key.role]
        //             } else {
        //                 object[key.role] = [key.scope]
        //             }
        //         }
        //     })
        // });
        return { data: success.data, user: userId }

    } catch (err) {
        console.error(err)
        throw err
    }
}

export async function usersForRole(role: string) {
    try {
        if (!role) throw new Error("Missing Role.");
        let Options = {
            uri: `${RBAC_URL}/role/user/list`,
            method: "GET",
            qs: {
                role: role,
            },
            json: true
        }
        let success = await request(Options);
        if (!success) throw new Error("Fail to get users.")
        let users = await userList({ _id: { $in: success.users } }, { firstName: 1, middleName: 1, lastName: 1, email: 1, phone: 1, is_active: 1 })
        return { role: role, users: users }
    } catch (err) {
        console.error(err);
        throw err;
    };
};

export async function capabilities() {
    try {
        let Options = {
            uri: `${RBAC_URL}/capabilities/list`,
            method: "GET",
            json: true
        }
        let data = await request(Options);
        if (!data.status) throw new Error("Error to fetch Roles")
        return data
    } catch (err) {
        console.error(err);
        throw err
    }
}

export async function allrolecapabilities() {
    try {
        let Options = {
            uri: `${RBAC_URL}/role/all/capabilities/list`,
            method: "GET",
            json: true
        }
        let data = await request(Options);
        if (!data.status) throw new Error("Error to fetch Roles")
        return data
    } catch (err) {
        console.error(err);
        throw err
    }
}

export async function addCapability(role: string, scope: string, capability: string, userId: string, auth?: Boolean) {
    try {
        auth = auth == false ? false : true
        if (auth) {
            let userRoles = await userRoleAndScope(userId);
            let userRole = userRoles.data[0];
            const isEligible = await checkRoleScope(userRole, "display-role-management");
            if (!isEligible) {
                throw new APIError("Unauthorized for this Action", 403);
            }
        }
        let Options = {
            uri: `${RBAC_URL}/capabilities/add`,
            method: "POST",
            body: {
                "role": role,
                "scope": scope,
                "capability": capability
            },
            json: true
        }
        return await request(Options);
    } catch (err) {
        if(err.statusCode && err.statusCode < 500){
            throw new APIError(err.message)
        } else {
            throw err;
        }
    };
};

export async function removeCapability(role: string, scope: string, capability: string, userId: string) {
    try {
        let userRoles = await userRoleAndScope(userId);
        let userRole = userRoles.data[0];
        const isEligible = await checkRoleScope(userRole, "display-role-management");
        if (!isEligible) {
            throw new APIError("Unauthorized for this Action", 403);
        }
        let Options = {
            uri: `${RBAC_URL}/capabilities/remove`,
            method: "PUT",
            body: {
                "role": role,
                "scope": scope,
                "capability": capability
            },
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err;
    };
};
export async function removeAllCapabilities() {
    try {
        let Options = {
            uri: `${RBAC_URL}/capabilities/remove/all`,
            method: "PUT",
            body: {},
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err;
    };
};

// export async function updateCapabilities(addCapabilities: any, removeCapabilities: any, userId: string) {
//     let userRoles = await userRoleAndScope(userId);
//     let userRole = userRoles.data[0];
//     const isEligible = await checkRoleScope(userRole, "display-role-management");
//     if (!isEligible) {
//         throw new APIError("Unauthorized for this Action", 403);
//     }
//     if ((addCapabilities || []).some((capability: any) => !capability.role || !capability.capability)) {
//         throw Error("All mandatory fields are required")
//     }
//     if ((removeCapabilities || []).some((capability: any) => !capability.role || !capability.capability)) {
//         throw Error("All mandatory fields are required")
//     }
//     return await Promise.all(
//         [...(addCapabilities || []).map((capability: any) => addCapability(capability.role, 'global', capability.capability, userId)),
//         ...(removeCapabilities || []).map((capability: any) => removeCapability(capability.role, 'global', capability.capability, userId))
//     ]).then(resp => {
//         createLog(addCapabilities, removeCapabilities, userId)
//         return {
//             success: true,
//             message: "Permissions updated successfully"
//         }
//     }).catch(error => {
//         console.error(error)
//         throw new APIError(error.message)
//     })
// }

export async function updateCapabilities(addCapabilities: any, removeCapabilities: any, userId: string) {
    try {
        let userRoles = await userRoleAndScope(userId);
        let userRole = userRoles.data[0];
        const isEligible = await checkRoleScope(userRole, "display-role-management");
        if (!isEligible) {
            throw new APIError("Unauthorized for this Action", 403);
        }
        let [capabilityAdd, capabilityRemove] = await Promise.all([
            (addCapabilities && addCapabilities)?addCapabilities.map(async (capability: any) => {
                if(!capability.role || !capability.capability){
                    throw Error("All mandatory fields are required")
                }
                await addCapability(capability.role, 'global', capability.capability, userId)
            }):[],
            (removeCapabilities && removeCapabilities)?removeCapabilities.map(async (capability: any) => {
                if(!capability.role || !capability.capability){
                    throw Error("All mandatory fields are required")
                }
                await removeCapability(capability.role, 'global', capability.capability, userId)
            }):[]
        ])
        createLog(addCapabilities, removeCapabilities, userId)
        return {
            success: true,
            message: "Permissions updated successfully"
        }
    } catch (err) {
        throw err;
    };
}

async function createLog(addCapabilities: any, removeCapabilities: any, userId: string){
    let roles = Array.from(new Set([...addCapabilities, ...removeCapabilities].map(capability => capability.role)))
    let capabilities: Array<any> = JSON.parse(fs.readFileSync(join(__dirname, "..", "utils", "capabilities.json"), "utf8"));
    const _roles = await role_list()

    roles = roles.map(role => ({
        role:((_roles.roles.find((_role: any) => _role.role == role) as any).roleName || (_roles.roles.find((_role: any) => _role.role == role) as any).description),
        addedCapabilities: addCapabilities.filter((_c: any) => _c.role == role).map((_capability: any) => capabilities.find(_c => _c.capability == _capability.capability)),
        removedCapabilities: removeCapabilities.filter((_c: any) => _c.role == role).map((_capability: any) => capabilities.find(_c => _c.capability == _capability.capability))
    }))
    let displayMessages: any[] = []
    roles.map(role => {
        // let displayMessage = `[from] ${role.addedCapabilities.length && `added `.concat(
        //     role.addedCapabilities.map((c: any) => c.shortDescription).join(`, `))
        //     .concat(`${role.removedCapabilities.length ? ` & ` : ``}`) || ``}`
        //     .concat(`${role.removedCapabilities.length && `removed ` + 
        //         role.removedCapabilities.map((c: any) => c.shortDescription).join(`, `)
        //         || ``}`
        //     || ``) + ` permission(s) to the role ${role.role}`
        if(role.addedCapabilities && role.addedCapabilities.length){
            displayMessages.push({
                activityBy: userId, activityType:`RBAC`,
                displayMessage:`[from] added ${role.addedCapabilities.map((c: any) => c.shortDescription).join(`, `)} permission(s) to the role ${role.role}`
            })
        }
        if(role.removedCapabilities && role.removedCapabilities.length){
            displayMessages.push({
                activityBy: userId, activityType:ACTIVITY_LOG.RBAC,
                displayMessage:`[from] removed ${role.removedCapabilities.map((c: any) => c.shortDescription).join(`, `)} permission(s) to the role ${role.role}`
            })
        }
    })
    await create([...displayMessages])
    return roles
}
export async function updaterole(role: string, bodyObj: any, userId: string) {
    try {
        let userRoles = await userRoleAndScope(userId);
        let userRole = userRoles.data[0];
        const isEligible = await checkRoleScope(userRole, "display-role-management");
        if (!isEligible) {
            throw new APIError("Unauthorized for this Action", 403);
        }

        let findRole = await roleSchema.find({ role: role })
        if (!findRole.length) {
            throw new Error("Role does not exist");
        }
        let roleData = findRole.map((_role: any) => {
            return _role;
        })
        let updateRole = await roleSchema.update({ role: role }, {
            category: bodyObj.category ? bodyObj.category : roleData[0].category,
            roleName: bodyObj.roleName ? bodyObj.roleName : roleData[0].roleName,
            description: bodyObj.description ? bodyObj.description : roleData[0].description
        }).exec()

        if (updateRole) {
            return { success: true, data: updaterole }
        }

    } catch (err) {
        console.log(err);
        throw err
    }
}

export async function addRolesFromJSON() {
    try {
        let data = await roles_list()
        if (!data.roles.length) throw new Error("Error to fetch Roles")
        let roles = data.roles.map((eachRole) => {
            return {
                role: eachRole.role,
                roleName: eachRole.description,
                description: eachRole.description,
                category: eachRole.category
            }
        })
        let response = await roleSchema.insertMany(roles);
        return { success: true, response };

    } catch (err) {
        console.error(err);
        throw err
    }
}

export async function addRole(userId: string, bodyObj: any) {
    try {
        let userRoles = await userRoleAndScope(userId);
        let userRole = userRoles.data[0];
        const isEligible = await checkRoleScope(userRole, "display-role-management");
        if (!isEligible) {
            throw new APIError("Unauthorized for this Action", 403);
        }
        if (!bodyObj.category || !bodyObj.roleName) throw new Error("All mandatory fields are reuired")
        let role = bodyObj.roleName.replace(/[^a-zA-Z0-9]/g, "")      
        role = role.toLowerCase().trim()
        let response = await roleSchema.create({
            role: role,
            roleName: bodyObj.roleName,
            description: bodyObj.description,
            category: bodyObj.category,
            createdBy: userId
        });
        addRoleNotification(role);
        return { success: true, response };

    } catch (err) {
        console.log(err);
        throw err
    }
}

export async function addRoleCapabilitiesFromJSON(userId: string) {
    try {
        await init();
        return { success: true }
    } catch (err) {
        console.error(err);
    }
}

export async function resetPermissions(userObj: any) {
    let response = await removeAllCapabilities()
    let defaultPermissions: Array<any> = JSON.parse(fs.readFileSync(join(__dirname, "..", "utils", "default_permissions.json"), "utf8"));
    let consructedPermissions = defaultPermissions.reduce((p, c) => {
        p = [...p,...c.permissions.reduce((p1: any,c1: any) => [...p1, {role:c.role, permission:c1}] ,[])]
        return p
    }, [])
    await Promise.all(consructedPermissions.map((permission: any) => addCapability(permission.role, 'global', permission.permission, "", false))) 
    return response
}