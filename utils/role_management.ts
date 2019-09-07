import * as fs from "fs";
import { join } from "path";
import * as request from "request-promise"
import { Users } from "../users/model";
import { hashPassword } from "./utils";
import { addRole } from "./rbac";

export async function init() {
    return new Promise(async (resolve, reject) => {
        let removeOptions = {
            url: `${process.env.RBAC_URL}/capabilities/remove/all`,
            method: "PUT",
            json: true
        }
        let removeCapabilities: any = await request(removeOptions);
        if (!removeCapabilities.status) throw "Something Went wrong while removeing the capabilities.";
        let capabilitiesObject = JSON.parse(fs.readFileSync(join(__dirname, "rbac.json"), "utf8"))
        let addOptions = {
            url: `${process.env.RBAC_URL}/capabilities/add/all`,
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                capabilities: capabilitiesObject
            },
            json: true
        }
        let addCapabilities: any = await request(addOptions);
        if (!addCapabilities.status) throw "Something Went wrong while adding the capabilities.";
        resolve("successfully added new capabilities");
    });
};

export async function userInit() {
    let users = await Users.find({})
    if (!users.length) {
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
        let grants = await addRole(user.id, "technology lead")
        console.log("Initial User successfully Created.")
    }
}

userInit().catch(err => console.log(err))