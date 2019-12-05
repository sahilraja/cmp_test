import { checkRoleScope } from "../../utils/role_management";
import { APIError } from "../../utils/custom-error";
import { financialSchema } from "./model";
import { RESPONSE } from "../../utils/error_msg";
import { Types } from "mongoose";


export interface financialObject {
    percentage: Number;
    phase: String;
    projectId: string;
    isDeleted: Boolean;
};

//  create financial-Info
export async function financialInfoCreate(body: any, projectId: string, userObj: any, ): Promise<any> {
    try {
        const isEligible = await checkRoleScope(userObj.role, "financial-info-management");
        if (!isEligible) throw new APIError("Unauthorized Action.", 403);
        if (!body.percentage || !body.phase || body.phase.trim() == "") throw new Error("Missing Required Fields.");
        let existPhase = await financialSchema.find({ projectId: projectId, phase: body.phase, isDeleted: false })
        if (existPhase.length) throw new Error("A Phase with same name already exists.")
        return financialSchema.create({ ...body, projectId, createdBy: userObj._id })
    } catch (err) {
        throw err
    };
};

//  edit financial-Info
export async function financialInfoEdit(projectId: string, financialId: string, body: any, userObj: any): Promise<any> {
    try {
        const isEligible = await checkRoleScope(userObj.role, "financial-info-management");
        if (!isEligible) throw new APIError("Unauthorized Action.", 403);
        let existPhase = await financialSchema.findOne({ projectId, phase: body.phase, isDeleted: false })
        if (existPhase && existPhase._id != financialId) throw new Error("A Phase with same name already exists.")
        return await financialSchema.findByIdAndUpdate(financialId, { $set: { ...body } }, { new: true })
    } catch (err) {
        throw err
    };
};

//  delete financial-Info 
export async function financialInfoDelete(projectId: string, financialId: string, userObj: any): Promise<{ message: string }> {
    try {
        const isEligible = await checkRoleScope(userObj.role, "financial-info-management");
        if (!isEligible) throw new APIError("Unauthorized Action.", 403);
        let PhaseDetails: any = await financialSchema.findById(financialId).exec();
        if (!PhaseDetails) throw new Error("Phase details Not Found.");
        let data: any = await financialSchema.findByIdAndUpdate(financialId, { $set: { isDeleted: PhaseDetails.isDeleted ? false : true } }, { new: true });
        return { message: data.isDeleted ? RESPONSE.INACTIVE : RESPONSE.ACTIVE };
    } catch (err) {
        throw err;
    };
};

//  delete financial-Info 
export async function financialInfoDetails(projectId: string, financialId: string, userObj: any): Promise<any> {
    try {
        const isEligible = await checkRoleScope(userObj.role, "financial-info-management");
        if (!isEligible) throw new APIError("Unauthorized Action.", 403);
        return await financialSchema.findById(financialId).populate("projectId").exec();
    } catch (err) {
        throw err;
    };
};

//  list financial-Info
export async function financialInfoList(projectId: string, userObj: any, validation: boolean = true, search?: string): Promise<any[]> {
    try {
        if (validation) {
            const isEligible = await checkRoleScope(userObj.role, "financial-info-management");
            if (!isEligible) throw new APIError("Unauthorized Action.", 403);
        }
        let searchQuery = search ? { name: new RegExp(search, "i"), isDeleted: false, projectId } : { projectId, isDeleted: false }
        return await financialSchema.find({ ...searchQuery }).exec()
    } catch (err) {
        throw err;
    };
};
