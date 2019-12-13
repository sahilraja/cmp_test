import { Schema, model, Types } from "mongoose";
import plugin from "mongoose-transform";

export enum RISK_STATUS {
    OPEN = 1, CLOSED = 2
}

const SchemaDef = new Schema({
    riskNumber: {type: Number},
    riskTrend: {type: Number, default: null},
    dateRaised:{type: Date},
    projectId: {type: Schema.Types.ObjectId, ref:'project'},
    riskFamily: { type: String, trim: true },
    description: { type: String, trim: true },
    phase: { type: Schema.Types.ObjectId, ref: 'phase' },
    impact: { type: Number, default: 0 },
    probability: { type: Number, default: 0 },
    actions: { type: String, trim: true },
    comments: { type: String, trim: true },
    riskProvision: { type: Number, default: 0 },
    riskOwner: { type: String },
    status: { type: String },
    previousTrend: { type: Number, default: 0 },
    deleted: { type: Boolean, default: false },
    parentId: {type: Types.ObjectId, default: null, ref: "risks"},
    createdBy: { type: String }
}, { timestamps: true })
SchemaDef.plugin(plugin)
export const RiskSchema = model(`risks`, SchemaDef)