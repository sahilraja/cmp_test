import { Schema, model } from "mongoose";
let SchemaDef = new Schema({
    name:{type: String},
    type: {type: String},
    fileId:{type: String}
})
export const UploadFormatSchema = model('upload_formats', SchemaDef)