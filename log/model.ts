import { Schema, model } from "mongoose";

const SchemaDef = new Schema({
    displayMessage:{type: String},
    activityType: { type: String, trim: true },
    activityBy: { type: String },
    taskId: { type: String },
    addedUserIds: { type: Array },
    documentAddedUsers: [{
        id: { type: String },
        type: { type: String },
        role: { typr: String }
    }],
    documentRemovedUsers: [{
        id: { type: String },
        type: { type: String },
        role: { typr: String }
    }],
    fromPublished: { type: Schema.Types.ObjectId, ref: 'documents' },
    replaceDoc: { type: Schema.Types.ObjectId, ref: 'documents' },
    tagsAdded: { type: Array },
    tagsRemoved: { type: Array },
    removedUserIds: { type: Array },
    oldStepId: { type: Schema.Types.ObjectId, ref: 'steps' },
    stepId: { type: Schema.Types.ObjectId, ref: 'steps' },
    oldPillarId: { type: Schema.Types.ObjectId, ref: 'pillars' },
    pillarId: { type: Schema.Types.ObjectId, ref: 'pillars' },
    subTask: { type: String },
    previousStartDate: { type: Date, default: null },
    updatedStartDate: { type: Date, default: null },
    previousDueDate: { type: Date, default: null },
    updatedDueDate: { type: Date, default: null },
    oldStatus: { type: Number },
    updatedStatus: { type: Number },
    oldCost: { type: Number, default: null },
    updatedCost: { type: Number, default: null },
    projectId: { type: Schema.Types.ObjectId, ref: 'project' },
    editedFields: {type: Array},
    profileId: { type: String},
    requestUserId: { type: String},
    documentId: { type: Schema.Types.ObjectId, ref: 'documents' },
    addedDocIds:[{type:Schema.Types.ObjectId, ref:'documents'}],
    removedDocIds:[{type:Schema.Types.ObjectId, ref:'documents'}],
    linkedTasks: {type: Array},
    unlinkedTasks:{type: Array},
    tagsToMerge:{type: Array},
    mergedTag: {type: String},
    oldMessage:{type: String},
    riskOpportunityNumber:{type: String},
    riskId:{type: Schema.Types.ObjectId, ref:`risks`},
    opportunityId:{type: Schema.Types.ObjectId, ref:`opportunities`},
    message: {type: String}
}, { timestamps: true })

SchemaDef.index({ projectId: 1 })
SchemaDef.index({ taskId: 1 })
SchemaDef.index({ activityType: 1 })
SchemaDef.index({ taskId: 1, activityType: 1 })

export const ActivitySchema = model('activity_log', SchemaDef)