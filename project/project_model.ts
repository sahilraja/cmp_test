import { Schema, model } from "mongoose";

const schema = new Schema({
    name: { type: String, trim:true },
    city: { type: String, trim: true },
    summary: { type: String },
    reference: { type: String, unique: true, trim: true, uppercase: true },
    bannerImage: { type: String },
    maturationStartDate: [
        {
            date: { type: Date },
            created_at: { type: Date },
            modified_at: { type: Date },
            modified_by: { type: Schema.Types.ObjectId, ref: 'Users' }
        }
    ],
    thirdParyAggrementDate: [
        {
            date: { type: Date },
            created_at: { type: Date },
            modified_at: { type: Date },
            modified_by: { type: Schema.Types.ObjectId, ref: 'Users' }
        }
    ],
    thirdParyAggrementDocument: [
        {
            document: { type: String },
            created_at: { type: Date },
            modified_at: { type: Date },
            modified_by: { type: Schema.Types.ObjectId, ref: 'Users' }
        }
    ],
    maturationEndDate: [
        {
            date: { type: Date },
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

export const project = model("project", schema);