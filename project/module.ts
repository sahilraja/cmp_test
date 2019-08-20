import { missing } from "../utils/Const";
import { city_code } from "./city_code_model";
import { Types } from "mongoose";
import { tags } from "./tag_model";
import { themes } from "./theme_model";

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
        let data = await city_code.findByIdAndUpdate(id, obj, { new: true })
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


//  add tag
export async function add_tag(reqObject: any) {
    try {
        if (!reqObject.tag) {
            throw new Error(missing);
        };
        let data = await tags.create({
            city_code: reqObject.city_code,
            description: reqObject.description || "N/A"
        })
        return { status: true, data: data }
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  edit tag
export async function edit_tag(id: any, reqObject: any) {
    try {
        let obj: any = {}
        if (reqObject.tag) {
            obj.tag = reqObject.tag;
        };
        if (reqObject.description) {
            obj.description = reqObject.description;
        };
        let data = await tags.findByIdAndUpdate(id, obj, { new: true })
        return { status: true, data: data }
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  get list of tags
export async function tag_list() {
    try {
        let data = await tags.find({ is_active: true })
        return { status: true, data: data }
    } catch (err) {
        console.log(err);
        throw err;
    }
};

//  edit status of tag
export async function tag_status(id: any) {
    try {
        let city = await tags.findById(id)
        if (!city) {
            throw new Error(missing)
        }
        let data = await tags.findByIdAndUpdate({ id }, { is_active: city.is_active == true ? false : true })
        return { status: true, data: data }
    } catch (err) {
        console.log(err);
        throw err;
    }
};

//  add theme
export async function add_theme(reqObject: any) {
    try {
        if (!reqObject.theme) {
            throw new Error(missing);
        };
        let data = await themes.create({
            city_code: reqObject.theme,
            description: reqObject.description || "N/A"
        })
        return { status: true, data: data }
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  edit theme
export async function edit_theme(id: any, reqObject: any) {
    try {
        let obj: any = {}
        if (reqObject.theme) {
            obj.tag = reqObject.theme;
        };
        if (reqObject.description) {
            obj.description = reqObject.description;
        };
        let data = await themes.findByIdAndUpdate(id, obj, { new: true })
        return { status: true, data: data }
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  get list of theme
export async function theme_list() {
    try {
        let data = await themes.find({ is_active: true })
        return { status: true, data: data }
    } catch (err) {
        console.log(err);
        throw err;
    }
};

//  edit status of theme
export async function theme_status(id: any) {
    try {
        let city = await themes.findById(id)
        if (!city) {
            throw new Error(missing)
        }
        let data = await themes.findByIdAndUpdate({ id }, { is_active: city.is_active == true ? false : true })
        return { status: true, data: data }
    } catch (err) {
        console.log(err);
        throw err;
    }
};