import { Schema, model } from "mongoose";
let SchemaDef = new Schema({
    state:{type: String},
    cities:{type:[String]}
})
export const CitySchema = model('cities', SchemaDef)