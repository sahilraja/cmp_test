import { Schema, model } from "mongoose";
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
            created_at: { type: Date },
            modified_at: { type: Date },
            modified_by: { type: Schema.Types.ObjectId, ref: 'Users' }
        }
    ],
    projectCost: [
        {
            cost: { type: Number },
            created_at: { type: Date },
            modified_at: { type: Date },
            modified_by: { type: Schema.Types.ObjectId, ref: 'Users' }
        }
    ],
    ciitiisGrants: [
        {
            cost: { type: Number },
            created_at: { type: Date },
            modified_at: { type: Date },
            modified_by: { type: Schema.Types.ObjectId, ref: 'Users' }
        }
    ],
    fundsReleased: [
        {
            cost: { type: Number },
            created_at: { type: Date },
            modified_at: { type: Date },
            modified_by: { type: Schema.Types.ObjectId, ref: 'Users' }
        }
    ],
    fundsUtilised: [
        {
            cost: { type: Number },
            created_at: { type: Date },
            modified_at: { type: Date },
            modified_by: { type: Schema.Types.ObjectId, ref: 'Users' }
        }
    ],
    fundsUtilisedDocuments: [
        {
            document: { type: String },
            created_at: { type: Date },
            modified_at: { type: Date },
            modified_by: { type: Schema.Types.ObjectId, ref: 'Users' }
        }
    ],
    themes: { type: Schema.Types.ObjectId, ref: 'themes' },
    is_active: { type: Boolean, default: true }
}, { timestamps: true });

schema.plugin(mongoosePaginate)
export const project = model("project", schema);