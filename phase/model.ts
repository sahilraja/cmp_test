import { Schema, model,Types} from "mongoose";
import * as mongoosePaginate from "mongoose-paginate";

const schema = new Schema({
    phaseName: { type: String,unique: true},
    colorCode: { type: String},
    createdBy : {type: String},  //userId
    disable: {type: Boolean,default: false}
}, { timestamps: true });

schema.plugin(mongoosePaginate);
export const phaseSchema = model("phase", schema);