import { RESPONSE } from "../utils/error_msg";
import { checkRoleScope } from "../utils/role_management";
import { APIError } from "../utils/custom-error";
import { userRoleAndScope } from "../role/module";
import { patternSchema } from "./model";

export interface patternObject {
    patternCode: string;
    patternName: String;
    createdBy: string;
    isDeleted: boolean
};

//  create pattern
export async function patternCreate(body: any, userObj: any): Promise<object> {
    try {
        const isEligible = await checkRoleScope(userObj.role, "patterns-management");
        if (!isEligible) throw new APIError("Unautherized Action.", 403);
        if (!body.patternCode || !body.patternName) throw new Error("Missing Required Fields.");
        let existPattern = await patternSchema.find({ patternCode: body.patternCode, isDeleted: false })
        if (existPattern.length) throw new Error("A pattern with same name already exists.")
        return patternSchema.create({ ...body, createdBy: userObj._id })
    } catch (err) {
        throw err
    };
};

//  edit Pattern
export async function patternEdit(patternId: string, body: any, userObj: any): Promise<any> {
    try {
        const isEligible = await checkRoleScope(userObj.role, "patterns-management");
        if (!isEligible) throw new APIError("Unautherized Action.", 403);
        let patternDetails: any = await patternSchema.findById(patternId).exec();
        if (!patternDetails) throw new Error("Pattern details Not Found.");
        if (!body.patternCode || !body.patternName) throw new Error("Missing Required Fields.");
        let existPattern = await patternSchema.findOne({ patternCode: body.patternCode, isDeleted: false })
        if (existPattern && existPattern._id != patternId) throw new Error("A pattern with same name already exists.")
        return await patternSchema.findByIdAndUpdate(patternId, { $set: { ...body } })
    } catch (err) {
        throw err
    };
};

//  change pattern status
export async function patternDelete(patternId: string, userObj: any): Promise<any> {
    try {
        const isEligible = await checkRoleScope(userObj.role, "patterns-management");
        if (!isEligible) throw new APIError("Unautherized Action.", 403);
        let patternDetails: any = await patternSchema.findById(patternId).exec();
        if (!patternDetails) throw new Error("Pattern details Not Found.");
        let data: any = await patternSchema.findByIdAndUpdate(patternId, { $set: { isDeleted: patternDetails.isDeleted ? false : true } });
        return { message: data.isDeleted ? RESPONSE.INACTIVE : RESPONSE.ACTIVE };
    } catch (err) {
        throw err;
    };
};

//  Get Group Detail
export async function patternDetails(patternId: string): Promise<any> {
    try {
        return await patternSchema.findById(patternId).exec()
    } catch (err) {
        throw err;
    };
};

//  Get Group Detail
export async function patternList(userObj: any, search?: string): Promise<any[]> {
    try {
        const isEligible = await checkRoleScope(userObj.role, "patterns-management");
        if (!isEligible) throw new APIError("Unautherized Action.", 403);
        let searchQuery = search ? { name: new RegExp(search, "i"), isDeleted: false } : { isDeleted: false }
        return await patternSchema.find({ ...searchQuery }).exec()
    } catch (err) {
        throw err;
    };
};


export async function patternSubstitutions(message: string): Promise<{ message: string }> {
    try {
        let allPatternCodes = message.match(/%(.*?)%/g)
        if (!allPatternCodes) return { message }
        allPatternCodes = allPatternCodes.map((code) => code.slice(1, code.length - 1))
        var allPatterns: any[] = await patternSchema.find({ patternCode: { $in: allPatternCodes }, isDeleted: false }).exec();
        for (const { patternCode, patternName } of allPatterns) {
            message = replaceAll(message, `%${patternCode}%`, patternName)
        }
        return { message }
    } catch (err) {
        throw err;
    }
}

function replaceAll(message: string, search: string, replacement: string) {
    return message.split(new RegExp(search, "i")).join(replacement);
}