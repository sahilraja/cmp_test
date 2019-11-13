import { Schema, model, Types } from "mongoose";
import * as mongoosePaginate from "mongoose-paginate";

const schema = new Schema({
    createdBy:{type: String},
    name: { type: String, trim:true },
    city: { type: String, trim: true },
    summary: { type: String },
    reference: { type: String, unique: true, trim: true, uppercase: true },
    bannerImage: { type: String },
    maturationStartDate: { date: { type: Date }, modifiedBy: { type: String } },
    maturationEndDate: { date: { type: Date }, modifiedBy: { type: String } },
    thirdParyAggrementDate: { date: { type: Date }, modifiedBy: { type: String }},
    members:{type: Array},
    thirdParyAggrementDocument: [
        {
            document: { type: String },
            createdAt: { type: Date },
            modifiedAt: { type: Date },
            modifiedBy: { type: String }
        }
    ],
    projectCost: { type: Number ,default:0},
    ciitiisGrants: { type: Number , default:0},
    fundsReleased: [
        {
            deleted:{type:Boolean, default: false},
            installment:{type:  Number},
            subInstallment:{type:  Number},
            document: {type: String},
            cost: { type: Number },
            createdAt: { type: Date },
            modifiedAt: { type: Date },
            modifiedBy: { type: String }
        }
    ],
    fundsUtilised: [
        {
            deleted:{type:Boolean, default: false},
            installment:{type:  Number},
            subInstallment:{type:  Number},
            document: {type: String},
            cost: { type: Number },
            createdAt: { type: Date },
            modifiedAt: { type: Date },
            modifiedBy: { type: String }
        }
    ],
    themes: { type: Schema.Types.ObjectId, ref: 'themes' },
    is_active: { type: Boolean, default: true },
    phase:{type:Types.ObjectId,ref:"phase"}
}, { timestamps: true });

schema.plugin(mongoosePaginate)
export const project = model("project", schema);