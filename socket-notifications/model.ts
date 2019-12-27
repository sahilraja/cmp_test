import { Schema, model } from "mongoose";
import * as mongoosePaginate from "mongoose-paginate";
export enum NotificationType {
    DOCUMENT, TASK, MESSAGE, PROJECT
}
const schemaDef = new Schema({
    from:{type: String},
    title:{type: String},
    notificationType: { type: String, required: true },
    userId: { type: String, required: true },
    taskId: { type: String, default: null },
    messageId: { type: String, default: null },
    documentId: { type: String, default: null },
    read: { type: Boolean, default: false }

}, { timestamps: true })
schemaDef.plugin(mongoosePaginate)
export const SocketNotifications = model(`web_notifiations`, schemaDef)