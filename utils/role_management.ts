import * as fs from "fs";
import { join } from "path";
import * as request from "request-promise"
import { Users } from "../users/model";
import { hashPassword } from "./utils";
import { addRole } from "./rbac";
import { RBAC_URL } from "./urls";

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
    let roles : Array<any> = JSON.parse(fs.readFileSync(join(__dirname, "rbac.json"), "utf8"))
    const capabilities = roles.reduce((capabilities, role) => {
        return capabilities.concat(role.capabilities.map((capability : any) => {
            return {...capability, role : role.role }
        }));
    }, []);
    let addOptions = {
        url: `${RBAC_URL}/capabilities/add/all`,
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: {
            capabilities
        },
        json: true
    }
    let addCapabilities: any = await request(addOptions);
    if (!addCapabilities.status) {
        throw "Something Went wrong while adding the capabilities.";
    }
    console.log("Added capabilities from rbac.json");
}

export async function userInit() {
    let existingUserCount = await Users.find({}).count();
    if (existingUserCount == 0) {
        let password = await hashPassword("Citiis@123")
        let user = await Users.create({
            "emailVerified": true,
            "phoneVerified": false,
            "firstName": "pranay",
            "secondName": "bhardwaj",
            "email": "pranay@citiis.com",
            "aboutme": "Technology lead for CITIIS Project",
            "password": password,
            "phone": "7989238348"
        })
        let grants = await addRole(user.id, "technology-lead")
        console.log("No existing users found. Technology specialist user created successfully");
    }
    else {
        console.log(`${existingUserCount} existing users found in DB`);
    }
}