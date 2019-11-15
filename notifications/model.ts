import {Schema,model} from "mongoose";
import * as mongoosePaginate from "mongoose-paginate";
const schema = new Schema({
    role: { type: String, unique: true},
    templates:[{
        templateName: {type: String},
        displayName: {type: String},
        email:{type:Boolean},
        mobile:{type: Boolean}
    }]
    },{ timestamps: true }
);

schema.plugin(mongoosePaginate);
export const notificationSchema = model("notifications", schema);