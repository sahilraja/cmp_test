import { missing } from "../utils/Const";
import { city_code } from "./city_code_model";
import { Types } from "mongoose";

//  add city code
export async function create_city_code(reqObject: any) {
    try {
        if (!reqObject.ctiy_code || !reqObject.city_name) {
            throw new Error(missing);
        };
        let data = await city_code.create({
            city_code: reqObject.city_code,
            city_name: reqObject.city_name,
            description: reqObject.description || "N/A"
        })
        return { status: true, data: data }
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  edit city code
export async function edit_city_code(id: any, reqObject: any) {
    try {
        let obj: any = {}
        if (reqObject.ctiy_code) {
            obj.city_code = reqObject.city_code;
        };
        if (reqObject.city_name) {
            obj.city_name = reqObject.city_name;
        };
        if (reqObject.description) {
            obj.description = reqObject.description;
        };
        let data = await city_code.updateOne({ id: Types.ObjectId(id) }, obj)
        return { status: true, data: data }
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  get list of city code
export async function city_code_list() {
    try {
        let data = await city_code.find({ is_active: true })
        return { status: true, data: data }
    } catch (err) {
        console.log(err);
        throw err;
    }
};

//  edit status of city code
export async function city_code_status(id: any) {
    try {
        let city = await city_code.findById(id)
        if (!city) {
            throw new Error(missing)
        }
        let data = await city_code.findByIdAndUpdate({ id }, { is_active: city.is_active == true ? false : true })
        return { status: true, data: data }
    } catch (err) {
        console.log(err);
        throw err;
    }
};