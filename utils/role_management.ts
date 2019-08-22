import * as fs from "fs";
import { join } from "path";
import { requestApi } from "./utils";


export async function init() {
    return new Promise(async (resolve, reject) => {
        let removeOptions = {
            url: `${process.env.RBAC_URL}/capabilities/remove/all`,
            method: "get",
            json: true
        }
        let removeCapabilities: any = await requestApi(removeOptions);
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
        let addCapabilities: any = await requestApi(addOptions);
        if (!addCapabilities.status) throw "Something Went wrong while adding the capabilities.";
        resolve("successfully added new capabilities");
    });
}