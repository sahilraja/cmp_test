import { Schema, model, Types } from "mongoose";
import * as mongoosePaginate from "mongoose-paginate";

const schema = new Schema({
    createdBy: { type: String },
    name: { type: String, trim: true },
    city: { type: String, trim: true },
    summary: { type: String },
    startDate: { type: Date, default: new Date() },
    endDate: { type: Date, default: new Date() },
    reference: { type: String, unique: true, trim: true, uppercase: true },
    bannerImage: { type: String },
    maturationStartDate: { date: { type: Date }, modifiedBy: { type: String } },
    maturationEndDate: { date: { type: Date }, modifiedBy: { type: String } },
    tripartiteAggrementDate: { date: { type: Date }, modifiedBy: { type: String } },
    members: { type: Array },
    miscomplianceSpv: { type: String, trim: true, default: null },
    miscomplianceProject: { type: String, trim: true, default: null },
    thirdParyAggrementDocument: [
        {
            document: { type: String },
            createdAt: { type: Date },
            modifiedAt: { type: Date },
            modifiedBy: { type: String }
        }
    ],
    projectCost: { type: Number, default: 0 },
    citiisGrants: { type: Number, default: 0 },
    fundsReleased: [
        {
            deleted: { type: Boolean, default: false },
            installment: { type: Number },
            percentage: { type: String },
            phase: { type: String },
            subInstallment: { type: Number },
            documents: { type: [String] },
            cost: { type: Number },
            createdAt: { type: Date },
            modifiedAt: { type: Date },
            modifiedBy: { type: String }
        }
    ],
    fundsUtilised: [
        {
            deleted: { type: Boolean, default: false },
            installment: { type: Number },
            percentage: { type: String },
            phase: { type: String },
            subInstallment: { type: Number },
            documents: { type: [String] },
            cost: { type: Number },
            createdAt: { type: Date },
            modifiedAt: { type: Date },
            modifiedBy: { type: String }
        }
    ],
    funds: [
        {
            deletedReleased: { type: Boolean, default: false },
            deletedUtilised: { type: Boolean, default: false },
            installment: { type: Number },
            percentage: { type: String },
            phase: { type: String },
            subInstallment: { type: Number },
            releasedDocuments: { type: [String] },
            releasedCost: { type: Number,default: 0 },
            utilisedDocuments: { type: [String] },
            utilisedCost: { type: Number, default: 0 },
            createdAt: { type: Date },
            modifiedAt: { type: Date },
            releasedBy: { type: String },
            utilisedBy: { type: String }
        }
    ],
    themes: { type: Schema.Types.ObjectId, ref: 'themes' },
    is_active: { type: Boolean, default: true },
    phases: [{ phase: { type: Types.ObjectId, ref: "phase" }, createdAt: { type: Date }, startDate: { type: Date }, endDate: { type: Date } }]
}, { timestamps: true });

schema.plugin(mongoosePaginate)
export const project = model("project", schema);