import { Schema, model } from "mongoose";
import plugin from "mongoose-transform";

const SchemaDef = new Schema({
    dateRaised:{type: Date},
    projectId: {type: Schema.Types.ObjectId, ref:'project'},
    opportunityFamily: { type: String, trim: true },
    description: { type: String, trim: true },
    phase: { type: Schema.Types.ObjectId, ref: 'phase' },
    impact: { type: Number, default: 0 },
    probability: { type: Number, default: 0 },
    actions: { type: String, trim: true },
    comments: { type: String, trim: true },
    opportunityProvision: { type: Number, default: 0 },
    opportunityOwner: { type: String },
    status: { type: String },
    previousTrend: { type: Number, default: 0 },
    deleted: { type: Boolean, default: false },
    createdBy: { type: String }
}, { timestamps: true })
SchemaDef.plugin(plugin)

export const OpportunitySchema = model('opportunities', SchemaDef)