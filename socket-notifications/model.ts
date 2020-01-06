import { Schema, model, Types } from "mongoose";
import * as mongoosePaginate from "mongoose-paginate";
export enum NotificationType {
    DOCUMENT, TASK, MESSAGE, PROJECT
}
const schemaDef = new Schema({
    from:{type: String},
    title:{type: String},
    notificationType: { type: String, required: true },
    userId: { type: String, required: true },
    docId: { type: Types.ObjectId, ref: 'documents' },
    taskId: { type: String, default: null },
    groupId: { type: String, default: null },
    messageId: { type: String, default: null },
    read: { type: Boolean, default: false }
}, { timestamps: true })
schemaDef.index({userId:1})
schemaDef.index({userId:1, read:1})
schemaDef.plugin(mongoosePaginate)
export const SocketNotifications = model(`web_notifiations`, schemaDef)